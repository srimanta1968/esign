import { Request, Response } from 'express';
import { DataService } from '../services/DataService';
import { StorageService } from '../services/storageService';
import { SigningTokenService, SigningToken } from '../services/signingTokenService';
import { WorkflowService } from '../services/workflowService';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  SigningWorkflow,
  WorkflowRecipient,
  SignatureField,
} from '../types/workflow';

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
   * Mark that the recipient has opened the signing page.
   * Idempotent: only the first call records opened_at and logs history.
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

      if (!alreadyOpened) {
        await DataService.query(
          'UPDATE workflow_recipients SET opened_at = NOW(), opened_ip = $1 WHERE id = $2 AND opened_at IS NULL',
          [actorIp, signingToken.recipient_id]
        );

        await WorkflowService.logHistory(signingToken.workflow_id, 'opened', recipient.signer_email, actorIp, {
          user_agent: userAgent,
          recipient_id: recipient.id,
          signing_order: recipient.signing_order,
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        success: true,
        data: {
          recipient_id: recipient.id,
          first_opened: !alreadyOpened,
          opened_at: alreadyOpened ? recipient.opened_at : new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Mark signing started error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
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
