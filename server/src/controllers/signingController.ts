import { Request, Response } from 'express';
import { DataService } from '../services/DataService';
import { StorageService } from '../services/storageService';
import { SigningTokenService, SigningToken } from '../services/signingTokenService';
import { PdfSigningService } from '../services/pdfSigningService';
import { WorkflowService } from '../services/workflowService';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  SigningWorkflow,
  WorkflowRecipient,
  SignatureField,
} from '../types/workflow';

/**
 * How long after sending a signing request an "open" is *labelled* as a likely
 * mail security scanner in the audit trail.
 *
 * Observed in production: Microsoft Defender Safe Links detonated signing links
 * 25 and 33 seconds after delivery, from Microsoft-owned addresses, executing
 * the page well enough to call /started.
 *
 * This is a hint on the history entry only. It deliberately no longer decides
 * whether an open counts, because the window cannot: the same tenant re-scanned
 * a link 1h53m after delivery — long past any plausible grace period — and that
 * scan would have been credited to the recipient. Confirmation now requires an
 * interaction, which no scanner performs. See markSigningInteraction.
 */
const SCANNER_GRACE_MS = 2 * 60 * 1000;

/**
 * How long page loads from the same client collapse into one recorded visit.
 *
 * A refresh, a restored mobile tab, or the viewer remounting all call /started
 * again. Every genuine visit belongs in the history — a sender needs to see the
 * recipient came back three times — but a burst from one sitting is noise.
 */
const VISIT_DEDUPE_MS = 10 * 60 * 1000;

/**
 * Page interactions that count as proof a person is working the document.
 * Both require a pointer or keyboard event against a specific field.
 */
const INTERACTION_KINDS = ['field_focus', 'field_filled'] as const;
type InteractionKind = (typeof INTERACTION_KINDS)[number];

/**
 * Which message carried the link the visitor followed.
 *
 * Both routes hand out the identical token URL, so nothing in a request can
 * reveal which message it came from. The link itself therefore says: the
 * automated mail appends ?via=email, a manually shared link ?via=manual, and
 * the page passes it back here. Best effort by nature — a forwarded mail keeps
 * the original marker — so it is recorded as provenance, never acted on.
 */
const ARRIVAL_SOURCES = ['email', 'manual'] as const;
type ArrivalSource = (typeof ARRIVAL_SOURCES)[number];

function readArrivalSource(body: unknown): ArrivalSource | null {
  const via = (body as { via?: string } | undefined)?.via;
  return ARRIVAL_SOURCES.includes(via as ArrivalSource) ? (via as ArrivalSource) : null;
}

interface SignatureSubmission {
  fieldId: string;
  signatureData: string; // base64
  signatureType: string; // 'drawn' | 'typed' | 'uploaded'
}

/**
 * SigningController handles public (token-based) and self-signing endpoints.
 */
export class SigningController {
  // ─── Public Token-Based Signing ────────────────────────────────────

  /**
   * GET /api/sign/:token
   * Get signing context for a token-authenticated recipient.
   */
  static async getSigningContext(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      // First try valid token
      const signingToken = await SigningTokenService.validateToken(token);
      if (signingToken) {
        const context = await SigningController.buildSigningContext(signingToken);
        if (!context) {
          res.status(404).json({ success: false, error: 'Workflow or recipient not found' });
          return;
        }
        res.status(200).json({ success: true, data: context });
        return;
      }

      // Token invalid — check why (used/expired/not found) and return status info
      const lookup = await SigningTokenService.lookupToken(token);

      if (lookup.reason === 'not_found') {
        res.status(401).json({ success: false, error: 'Invalid signing token' });
        return;
      }

      if (lookup.reason === 'expired') {
        res.status(401).json({ success: false, error: 'This signing link has expired' });
        return;
      }

      // Token was used — could be because the recipient signed, OR because
      // the workflow was cancelled (cancelWorkflow marks all unused tokens used).
      // Check workflow status first so a cancelled workflow doesn't masquerade
      // as "already signed".
      if (lookup.reason === 'used' && lookup.signingToken) {
        const recipient = await DataService.queryOne<WorkflowRecipient>(
          'SELECT * FROM workflow_recipients WHERE id = $1',
          [lookup.signingToken.recipient_id]
        );
        const workflow = await DataService.queryOne<SigningWorkflow>(
          'SELECT * FROM signing_workflows WHERE id = $1',
          [lookup.signingToken.workflow_id]
        );
        const document = await DataService.queryOne<{ original_name: string }>(
          'SELECT original_name FROM documents WHERE id = $1',
          [workflow?.document_id || '']
        );

        if (workflow?.status === 'cancelled') {
          res.status(200).json({
            success: true,
            data: {
              cancelled: true,
              recipient: {
                name: recipient?.signer_name || '',
                email: recipient?.signer_email || '',
              },
              document: {
                name: document?.original_name || 'Document',
              },
              workflow: {
                status: 'cancelled',
              },
            },
          });
          return;
        }

        res.status(200).json({
          success: true,
          data: {
            already_signed: true,
            recipient: {
              name: recipient?.signer_name || '',
              email: recipient?.signer_email || '',
              signed_at: recipient?.signed_at || null,
            },
            document: {
              name: document?.original_name || 'Document',
            },
            workflow: {
              status: workflow?.status || 'unknown',
            },
          },
        });
        return;
      }

      res.status(401).json({ success: false, error: 'Invalid, expired, or already used signing token' });
    } catch (error: any) {
      console.error('Get signing context error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * POST /api/sign/:token/complete
   * Submit signatures for all assigned fields.
   */
  static async completeSigning(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const { signatures } = req.body as { signatures: SignatureSubmission[] };

      if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
        res.status(400).json({ success: false, error: 'signatures array is required and must not be empty' });
        return;
      }

      const signingToken = await SigningTokenService.validateToken(token);
      if (!signingToken) {
        res.status(401).json({ success: false, error: 'Invalid, expired, or already used signing token' });
        return;
      }

      // Validate workflow is active
      const workflow = await DataService.queryOne<SigningWorkflow>(
        'SELECT * FROM signing_workflows WHERE id = $1',
        [signingToken.workflow_id]
      );
      if (!workflow || workflow.status !== 'active') {
        res.status(409).json({ success: false, error: 'Workflow is not active' });
        return;
      }

      // Get recipient
      const recipient = await DataService.queryOne<WorkflowRecipient>(
        'SELECT * FROM workflow_recipients WHERE id = $1',
        [signingToken.recipient_id]
      );
      if (!recipient) {
        res.status(404).json({ success: false, error: 'Recipient not found' });
        return;
      }

      if (recipient.status === 'signed') {
        res.status(409).json({ success: false, error: 'You have already signed this document' });
        return;
      }

      if (recipient.status === 'declined') {
        res.status(409).json({ success: false, error: 'You have declined this workflow' });
        return;
      }

      // For sequential workflows, check signing order
      if (workflow.workflow_type === 'sequential') {
        const recipients = await DataService.queryAll<WorkflowRecipient>(
          'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
          [workflow.id]
        );
        const pendingBefore = recipients.filter(
          r => r.signing_order < recipient.signing_order && r.status === 'pending'
        );
        if (pendingBefore.length > 0) {
          res.status(409).json({ success: false, error: 'It is not your turn to sign yet' });
          return;
        }
      }

      // Get required fields for this recipient
      const recipientFields = await DataService.queryAll<SignatureField & { required: boolean }>(
        'SELECT * FROM signature_fields WHERE workflow_id = $1 AND recipient_id = $2',
        [signingToken.workflow_id, signingToken.recipient_id]
      );

      // Validate all required fields are signed
      const requiredFieldIds = recipientFields
        .filter(f => f.required !== false) // default to required
        .map(f => f.id);
      const signedFieldIds = signatures.map(s => s.fieldId);
      const missingFields = requiredFieldIds.filter(id => !signedFieldIds.includes(id));

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      // Validate submitted field IDs belong to this recipient
      const validFieldIds = recipientFields.map(f => f.id);
      const invalidFields = signedFieldIds.filter(id => !validFieldIds.includes(id));
      if (invalidFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Fields do not belong to this recipient: ${invalidFields.join(', ')}`,
        });
        return;
      }

      // Store signature data for each field
      const validSignatureTypes = ['drawn', 'typed', 'uploaded'];
      for (const sig of signatures) {
        const sigType = validSignatureTypes.includes(sig.signatureType) ? sig.signatureType : 'drawn';
        await DataService.query(
          `UPDATE signature_fields SET signature_data = $1, signature_type = $2, signed_at = NOW()
           WHERE id = $3 AND recipient_id = $4`,
          [sig.signatureData, sigType, sig.fieldId, signingToken.recipient_id]
        );
      }

      // Mark recipient as signed
      await DataService.query(
        "UPDATE workflow_recipients SET status = 'signed', signed_at = NOW() WHERE id = $1",
        [signingToken.recipient_id]
      );

      // Mark token as used
      await SigningTokenService.markTokenUsed(signingToken.id);

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Log to workflow history
      await WorkflowService.logHistory(signingToken.workflow_id, 'signed', recipient.signer_email, actorIp, {
        user_agent: userAgent,
        recipient_id: recipient.id,
        signing_order: recipient.signing_order,
        fields_signed: signatures.length,
        signing_method: 'token',
        timestamp: new Date().toISOString(),
      });

      // Handle post-sign: completion check, progress notifications, next signer email
      const { allSigned } = await WorkflowService.handlePostSign(workflow, recipient.signer_email, actorIp, userAgent);

      res.status(200).json({
        success: true,
        data: {
          message: 'Signing completed successfully',
          workflow_status: allSigned ? 'completed' : 'active',
          fields_signed: signatures.length,
        },
      });
    } catch (error: any) {
      console.error('Complete signing error:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * POST /api/sign/:token/started
   * Record a fetch of the signing page.
   *
   * Every visit is logged, not just the first. The sender's question is "has
   * anything happened since I sent this", and a single first-touch entry cannot
   * answer it: a recipient who came back twice and downloaded the document
   * looked identical to one who never returned. Repeat loads from the same
   * client inside VISIT_DEDUPE_MS collapse into the visit already recorded.
   *
   * This endpoint never confirms an open — see markSigningInteraction.
   */
  static async markSigningStarted(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const signingToken = await SigningTokenService.validateToken(token);
      if (!signingToken) {
        res.status(401).json({ success: false, error: 'Invalid, expired, or already used signing token' });
        return;
      }

      const recipient = await DataService.queryOne<WorkflowRecipient & { opened_at: Date | null }>(
        'SELECT * FROM workflow_recipients WHERE id = $1',
        [signingToken.recipient_id]
      );
      if (!recipient) {
        res.status(404).json({ success: false, error: 'Recipient not found' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const alreadyOpened = !!recipient.opened_at;

      // Mail-security products fetch every link they deliver, and Defender Safe
      // Links renders the page in a real headless browser, so it reaches this
      // endpoint exactly as a person would. Proximity to the send is recorded as
      // a hint, but nothing here is treated as the recipient reading the
      // document — that decision moved to the interaction endpoint.
      const openedWithin = recipient.notified_at
        ? Date.now() - new Date(recipient.notified_at).getTime()
        : Number.MAX_SAFE_INTEGER;
      const looksAutomated = openedWithin < SCANNER_GRACE_MS;

      if (!alreadyOpened) {
        await DataService.query(
          'UPDATE workflow_recipients SET opened_at = NOW(), opened_ip = $1, opened_user_agent = $2 WHERE id = $3 AND opened_at IS NULL',
          [actorIp, userAgent, signingToken.recipient_id]
        );
      }

      // One round trip for both halves of the dedupe decision: how many visits
      // are already on record, and who made the most recent one.
      const priorVisits = await DataService.queryOne<{
        visit_count: number;
        last_visit: Date | null;
        last_ip: string | null;
        last_user_agent: string | null;
      }>(
        `SELECT COUNT(*)::int AS visit_count,
                MAX(created_at) AS last_visit,
                (ARRAY_AGG(actor_ip ORDER BY created_at DESC))[1] AS last_ip,
                (ARRAY_AGG(metadata->>'user_agent' ORDER BY created_at DESC))[1] AS last_user_agent
           FROM workflow_history
          WHERE workflow_id = $1
            AND action = 'opened'
            AND metadata->>'recipient_id' = $2`,
        [signingToken.workflow_id, signingToken.recipient_id]
      );

      const visitCount = priorVisits?.visit_count || 0;
      const sinceLastVisit = priorVisits?.last_visit
        ? Date.now() - new Date(priorVisits.last_visit).getTime()
        : Number.MAX_SAFE_INTEGER;
      const sameClient =
        priorVisits?.last_ip === actorIp && priorVisits?.last_user_agent === userAgent;
      const isSameSitting = sameClient && sinceLastVisit < VISIT_DEDUPE_MS;

      if (!isSameSitting) {
        await WorkflowService.logHistory(signingToken.workflow_id, 'opened', recipient.signer_email, actorIp, {
          user_agent: userAgent,
          recipient_id: recipient.id,
          signing_order: recipient.signing_order,
          timestamp: new Date().toISOString(),
          visit_number: visitCount + 1,
          arrived_via: readArrivalSource(req.body),
          // Kept on the history entry so an audit can tell a scan from a read.
          likely_scanner: looksAutomated,
          seconds_after_send: recipient.notified_at ? Math.round(openedWithin / 1000) : null,
        });
      }

      res.status(200).json({
        success: true,
        data: {
          recipient_id: recipient.id,
          first_opened: !alreadyOpened,
          opened_at: alreadyOpened ? recipient.opened_at : new Date().toISOString(),
          visit_number: isSameSitting ? visitCount : visitCount + 1,
          confirmed: !!recipient.opened_confirmed_at,
        },
      });
    } catch (error: any) {
      console.error('Mark signing started error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * POST /api/sign/:token/interacted
   * Record that a person is actually working the document.
   *
   * Loading a page proves only that something followed the link. Focusing or
   * filling a field requires a pointer or keyboard event aimed at one specific
   * field — mail-security scanners fetch and render, they do not do that. So
   * this, not the page load, is what sets opened_confirmed_at and what the UI
   * reports as "opened".
   *
   * Idempotent: the first interaction confirms the open and writes one history
   * entry; later ones are accepted and ignored, so the client can fire freely.
   */
  static async markSigningInteraction(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;
      const requested = (req.body as { kind?: string } | undefined)?.kind;
      const kind: InteractionKind = INTERACTION_KINDS.includes(requested as InteractionKind)
        ? (requested as InteractionKind)
        : 'field_focus';

      const signingToken = await SigningTokenService.validateToken(token);
      if (!signingToken) {
        res.status(401).json({ success: false, error: 'Invalid, expired, or already used signing token' });
        return;
      }

      const recipient = await DataService.queryOne<WorkflowRecipient & { opened_at: Date | null }>(
        'SELECT * FROM workflow_recipients WHERE id = $1',
        [signingToken.recipient_id]
      );
      if (!recipient) {
        res.status(404).json({ success: false, error: 'Recipient not found' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const alreadyConfirmed = !!recipient.opened_confirmed_at;

      if (!alreadyConfirmed) {
        await DataService.query(
          `UPDATE workflow_recipients
              SET opened_confirmed_at = NOW(),
                  opened_at = COALESCE(opened_at, NOW())
            WHERE id = $1 AND opened_confirmed_at IS NULL`,
          [signingToken.recipient_id]
        );

        await WorkflowService.logHistory(signingToken.workflow_id, 'engaged', recipient.signer_email, actorIp, {
          user_agent: userAgent,
          recipient_id: recipient.id,
          signing_order: recipient.signing_order,
          interaction: kind,
          arrived_via: readArrivalSource(req.body),
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        success: true,
        data: {
          recipient_id: recipient.id,
          first_interaction: !alreadyConfirmed,
          confirmed_at: alreadyConfirmed
            ? recipient.opened_confirmed_at
            : new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Mark signing interaction error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * GET /api/sign/:token/signed-copy
   * Serve the signer their own copy of the document as signed.
   *
   * Deliberately accepts a used or expired token: signing marks the token used,
   * and this is the link the signer is emailed once they have signed. It stays
   * read-only and is gated on that recipient having signed, so a used token can
   * fetch a copy but can never sign again. Without this an external signer had
   * no way to obtain the document at all — the downloads portal needs an
   * account and a completed workflow.
   */
  static async getSignedCopy(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const { signingToken } = await SigningTokenService.lookupToken(token);
      if (!signingToken) {
        res.status(404).json({ success: false, error: 'Unknown signing link' });
        return;
      }

      const recipient = await DataService.queryOne<WorkflowRecipient>(
        'SELECT * FROM workflow_recipients WHERE id = $1',
        [signingToken.recipient_id]
      );
      if (!recipient) {
        res.status(404).json({ success: false, error: 'Recipient not found' });
        return;
      }
      if (recipient.status !== 'signed') {
        res.status(403).json({
          success: false,
          error: 'A signed copy becomes available once you have signed this document',
        });
        return;
      }

      const workflow = await DataService.queryOne<SigningWorkflow>(
        'SELECT * FROM signing_workflows WHERE id = $1',
        [signingToken.workflow_id]
      );
      if (!workflow) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      const document = await DataService.queryOne<{ original_name: string }>(
        'SELECT original_name FROM documents WHERE id = $1',
        [workflow.document_id]
      );
      const baseName = (document?.original_name || 'document').replace(/\.pdf$/i, '');

      // Once everyone has signed, the stored copy is the canonical one the
      // certificate attests to. Before that there is nothing stored — rendering
      // on demand is what makes an early signer's link work at all, and it
      // deliberately writes nothing, so the final copy is still generated from
      // the complete set of signatures. See buildSignedPdfBytes.
      const fileBuffer = workflow.signed_pdf_path
        ? await StorageService.getFile(workflow.signed_pdf_path)
        : Buffer.from(await PdfSigningService.buildSignedPdfBytes(workflow.id));

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName}-signed.pdf"`);
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('Get signed copy error:', error);
      res.status(500).json({ success: false, error: 'Could not produce the signed copy' });
    }
  }

  /**
   * GET /api/sign/:token/document
   * Serve the actual document file for the token's workflow.
   */
  static async getDocument(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.params;

      const signingToken = await SigningTokenService.validateToken(token);
      if (!signingToken) {
        res.status(401).json({ success: false, error: 'Invalid, expired, or already used signing token' });
        return;
      }

      const workflow = await DataService.queryOne<SigningWorkflow>(
        'SELECT * FROM signing_workflows WHERE id = $1',
        [signingToken.workflow_id]
      );
      if (!workflow) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      const document = await DataService.queryOne<{
        id: string;
        file_path: string;
        original_name: string;
        mime_type: string;
      }>(
        'SELECT id, file_path, original_name, mime_type FROM documents WHERE id = $1',
        [workflow.document_id]
      );

      if (!document) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const downloadName = document.original_name || 'document';
      const mimeType = document.mime_type || SigningController.detectMimeType(document.original_name || document.file_path);
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';

      try {
        const fileBuffer = await StorageService.getFile(document.file_path);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `${disposition}; filename="${downloadName}"`);
        res.send(fileBuffer);
      } catch (fileErr) {
        console.error('Document serve error:', fileErr);
        res.status(404).json({ success: false, error: 'File not found' });
      }
    } catch (error: any) {
      console.error('Get signing document error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ─── Authenticated Document File Serving ───────────────────────────

  /**
   * GET /api/documents/:id/file
   * Serve document file for authenticated users.
   */
  static async getAuthenticatedDocument(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const documentId = req.params.id;
      const document = await DataService.queryOne<{
        id: string;
        user_id: string;
        file_path: string;
        original_name: string;
        mime_type: string;
      }>(
        'SELECT id, user_id, file_path, original_name, mime_type FROM documents WHERE id = $1 AND user_id = $2',
        [documentId, req.userId]
      );

      if (!document) {
        res.status(404).json({ success: false, error: 'Document not found' });
        return;
      }

      const downloadName = document.original_name || 'document';
      const mimeType = document.mime_type || SigningController.detectMimeType(document.original_name || document.file_path);

      try {
        const fileBuffer = await StorageService.getFile(document.file_path);
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `inline; filename="${downloadName}"`);
        res.send(fileBuffer);
      } catch (fileErr) {
        console.error('Document serve error:', fileErr);
        res.status(404).json({ success: false, error: 'File not found' });
      }
    } catch (error: any) {
      console.error('Get authenticated document error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // ─── Self-Signing ─────────────────────────────────────────────────

  /**
   * POST /api/workflows/:id/self-sign
   * Allow the workflow creator to sign their own fields (if they are a recipient).
   */
  static async selfSign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const workflowId = req.params.id;
      const { signatures } = req.body as { signatures: SignatureSubmission[] };

      if (!signatures || !Array.isArray(signatures) || signatures.length === 0) {
        res.status(400).json({ success: false, error: 'signatures array is required and must not be empty' });
        return;
      }

      // Get workflow
      const workflow = await DataService.queryOne<SigningWorkflow>(
        'SELECT * FROM signing_workflows WHERE id = $1',
        [workflowId]
      );
      if (!workflow) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      if (workflow.status !== 'active') {
        res.status(409).json({ success: false, error: 'Workflow is not active' });
        return;
      }

      // Verify the authenticated user is actually a recipient
      const recipient = await DataService.queryOne<WorkflowRecipient>(
        'SELECT * FROM workflow_recipients WHERE workflow_id = $1 AND signer_email = $2',
        [workflowId, req.userEmail]
      );

      if (!recipient) {
        res.status(403).json({ success: false, error: 'You are not a recipient of this workflow' });
        return;
      }

      if (recipient.status === 'signed') {
        res.status(409).json({ success: false, error: 'You have already signed this document' });
        return;
      }

      if (recipient.status === 'declined') {
        res.status(409).json({ success: false, error: 'You have declined this workflow' });
        return;
      }

      // For sequential workflows, check signing order
      if (workflow.workflow_type === 'sequential') {
        const allRecipients = await DataService.queryAll<WorkflowRecipient>(
          'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
          [workflowId]
        );
        const pendingBefore = allRecipients.filter(
          r => r.signing_order < recipient.signing_order && r.status === 'pending'
        );
        if (pendingBefore.length > 0) {
          res.status(409).json({ success: false, error: 'It is not your turn to sign yet' });
          return;
        }
      }

      // Get fields for this recipient
      const recipientFields = await DataService.queryAll<SignatureField & { required: boolean }>(
        'SELECT * FROM signature_fields WHERE workflow_id = $1 AND recipient_id = $2',
        [workflowId, recipient.id]
      );

      // Validate required fields
      const requiredFieldIds = recipientFields
        .filter(f => f.required !== false)
        .map(f => f.id);
      const signedFieldIds = signatures.map(s => s.fieldId);
      const missingFields = requiredFieldIds.filter(id => !signedFieldIds.includes(id));

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      // Validate field ownership
      const validFieldIds = recipientFields.map(f => f.id);
      const invalidFields = signedFieldIds.filter(id => !validFieldIds.includes(id));
      if (invalidFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Fields do not belong to you: ${invalidFields.join(', ')}`,
        });
        return;
      }

      // Store signature data
      const validSigTypes = ['drawn', 'typed', 'uploaded'];
      for (const sig of signatures) {
        const sigType = validSigTypes.includes(sig.signatureType) ? sig.signatureType : 'drawn';
        await DataService.query(
          `UPDATE signature_fields SET signature_data = $1, signature_type = $2, signed_at = NOW()
           WHERE id = $3 AND recipient_id = $4`,
          [sig.signatureData, sigType, sig.fieldId, recipient.id]
        );
      }

      // Mark recipient as signed
      await DataService.query(
        "UPDATE workflow_recipients SET status = 'signed', signed_at = NOW() WHERE id = $1",
        [recipient.id]
      );

      // Mark any signing token as used
      const existingToken = await SigningTokenService.getTokenByRecipient(workflowId, recipient.id);
      if (existingToken) {
        await SigningTokenService.markTokenUsed(existingToken.id);
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Log to workflow history
      await WorkflowService.logHistory(workflowId, 'signed', req.userEmail, actorIp, {
        user_agent: userAgent,
        recipient_id: recipient.id,
        signing_order: recipient.signing_order,
        fields_signed: signatures.length,
        signing_method: 'self-sign',
        timestamp: new Date().toISOString(),
      });

      // Handle post-sign: completion check, progress notifications, next signer email
      const { allSigned } = await WorkflowService.handlePostSign(workflow, req.userEmail!, actorIp, userAgent);

      res.status(200).json({
        success: true,
        data: {
          message: 'Self-signing completed successfully',
          workflow_status: allSigned ? 'completed' : 'active',
          fields_signed: signatures.length,
        },
      });
    } catch (error: any) {
      console.error('Self-sign error:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  private static detectMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
    };
    return map[ext || ''] || 'application/octet-stream';
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Build the signing context (document info, fields, recipient info) from a token.
   */
  private static async buildSigningContext(signingToken: SigningToken) {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [signingToken.workflow_id]
    );
    if (!workflow) return null;

    const recipient = await DataService.queryOne<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE id = $1',
      [signingToken.recipient_id]
    );
    if (!recipient) return null;

    const document = await DataService.queryOne<{
      id: string;
      original_name: string;
      file_type: string;
      mime_type: string;
    }>(
      'SELECT id, original_name, file_type, mime_type FROM documents WHERE id = $1',
      [workflow.document_id]
    );

    const fields = await DataService.queryAll<SignatureField & { required: boolean }>(
      'SELECT * FROM signature_fields WHERE workflow_id = $1 AND recipient_id = $2',
      [signingToken.workflow_id, signingToken.recipient_id]
    );

    // Get creator info
    const creator = await DataService.queryOne<{ name: string; email: string }>(
      'SELECT name, email FROM users WHERE id = $1',
      [workflow.creator_id]
    );

    return {
      workflow: {
        id: workflow.id,
        status: workflow.status,
        workflow_type: workflow.workflow_type,
      },
      document: document ? {
        id: document.id,
        name: document.original_name,
        file_type: document.file_type,
        mime_type: document.mime_type,
      } : null,
      recipient: {
        id: recipient.id,
        email: recipient.signer_email,
        name: recipient.signer_name,
        status: recipient.status,
        signing_order: recipient.signing_order,
      },
      sender: creator ? {
        name: creator.name || creator.email,
        email: creator.email,
      } : null,
      fields: fields.map(f => ({
        id: f.id,
        field_type: f.field_type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required !== false,
        label: (f as any).label ?? null,
      })),
    };
  }
}

export default SigningController;
