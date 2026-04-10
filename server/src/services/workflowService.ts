import { DataService } from './DataService';
import { NotificationService } from './notificationService';
import { EmailService } from './emailService';
import { SigningTokenService } from './signingTokenService';
import { PdfSigningService } from './pdfSigningService';
import { CertificateService } from './certificateService';
import { StorageService } from './storageService';
import {
  SigningWorkflow,
  WorkflowRecipient,
  SignatureField,
  WorkflowReminder,
  WorkflowHistory,
  WorkflowResponse,
  WorkflowRecipientResponse,
  SignatureFieldResponse,
  WorkflowHistoryResponse,
  WorkflowStatusResponse,
  WorkflowType,
  WorkflowAction,
  CreateWorkflowRequest,
  UpdateWorkflowRequest,
} from '../types/workflow';

/**
 * WorkflowService handles signing workflow business logic for EP-247.
 */
export class WorkflowService {
  // ─── Task 1: Recipient and signing order ───────────────────────────

  /**
   * Create a new signing workflow with recipients and optional fields.
   */
  static async createWorkflow(
    creatorId: string,
    creatorEmail: string,
    data: CreateWorkflowRequest,
    actorIp: string,
    userAgent: string
  ): Promise<WorkflowResponse> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      `INSERT INTO signing_workflows (document_id, creator_id, workflow_type, status)
       VALUES ($1, $2, $3, 'draft')
       RETURNING *`,
      [data.document_id, creatorId, data.workflow_type]
    );

    if (!workflow) {
      throw new Error('Failed to create workflow');
    }

    // Insert recipients
    const recipients: WorkflowRecipient[] = [];
    for (const r of data.recipients) {
      const recipient = await DataService.queryOne<WorkflowRecipient>(
        `INSERT INTO workflow_recipients (workflow_id, signer_email, signer_name, signing_order, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [workflow.id, r.signer_email, r.signer_name, r.signing_order]
      );
      if (recipient) recipients.push(recipient);
    }

    // Insert signature fields if provided
    const fields: SignatureField[] = [];
    if (data.fields && data.fields.length > 0) {
      for (const f of data.fields) {
        const recipientId = recipients[f.recipient_index]?.id;
        if (!recipientId) continue;
        const field = await DataService.queryOne<SignatureField>(
          `INSERT INTO signature_fields (workflow_id, recipient_id, field_type, page, x, y, width, height, required)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [workflow.id, recipientId, f.field_type, f.page, f.x, f.y, f.width, f.height, f.required !== false]
        );
        if (field) fields.push(field);
      }
    }

    // Log history
    await WorkflowService.logHistory(workflow.id, 'created', creatorEmail, actorIp, {
      user_agent: userAgent,
      workflow_type: data.workflow_type,
      recipient_count: data.recipients.length,
    });

    return await WorkflowService.formatWorkflowResponse(workflow, recipients, fields);
  }

  /**
   * List all workflows for a user (created by them or where they are a recipient).
   */
  static async listWorkflows(userId: string, userEmail: string): Promise<WorkflowResponse[]> {
    const workflows = await DataService.queryAll<SigningWorkflow>(
      `SELECT DISTINCT sw.* FROM signing_workflows sw
       LEFT JOIN workflow_recipients wr ON wr.workflow_id = sw.id
       WHERE sw.creator_id = $1 OR wr.signer_email = $2
       ORDER BY sw.updated_at DESC`,
      [userId, userEmail]
    );

    const results: WorkflowResponse[] = [];
    for (const workflow of workflows) {
      const recipients = await DataService.queryAll<WorkflowRecipient>(
        'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
        [workflow.id]
      );
      const fields = await DataService.queryAll<SignatureField>(
        'SELECT * FROM signature_fields WHERE workflow_id = $1',
        [workflow.id]
      );
      results.push(await WorkflowService.formatWorkflowResponse(workflow, recipients, fields));
    }
    return results;
  }

  /**
   * Get workflow details by ID.
   */
  static async getWorkflow(workflowId: string): Promise<WorkflowResponse | null> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );
    if (!workflow) return null;

    const recipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    const fields = await DataService.queryAll<SignatureField>(
      'SELECT * FROM signature_fields WHERE workflow_id = $1',
      [workflowId]
    );

    return await WorkflowService.formatWorkflowResponse(workflow, recipients, fields);
  }

  /**
   * Update workflow recipients and/or fields (only if draft).
   */
  static async updateWorkflow(
    workflowId: string,
    creatorId: string,
    creatorEmail: string,
    data: UpdateWorkflowRequest,
    actorIp: string,
    userAgent: string
  ): Promise<WorkflowResponse | null> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1 AND creator_id = $2',
      [workflowId, creatorId]
    );
    if (!workflow) return null;

    if (workflow.status !== 'draft') {
      throw new Error('Cannot update a workflow that is not in draft status');
    }

    let recipients: WorkflowRecipient[] = [];
    let fields: SignatureField[] = [];

    if (data.recipients) {
      // Remove old recipients and their fields
      await DataService.query(
        'DELETE FROM signature_fields WHERE workflow_id = $1',
        [workflowId]
      );
      await DataService.query(
        'DELETE FROM workflow_recipients WHERE workflow_id = $1',
        [workflowId]
      );

      // Insert new recipients
      for (const r of data.recipients) {
        const recipient = await DataService.queryOne<WorkflowRecipient>(
          `INSERT INTO workflow_recipients (workflow_id, signer_email, signer_name, signing_order, status)
           VALUES ($1, $2, $3, $4, 'pending')
           RETURNING *`,
          [workflowId, r.signer_email, r.signer_name, r.signing_order]
        );
        if (recipient) recipients.push(recipient);
      }
    } else {
      recipients = await DataService.queryAll<WorkflowRecipient>(
        'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
        [workflowId]
      );
    }

    if (data.fields) {
      // Remove old fields only if recipients weren't already replaced
      if (!data.recipients) {
        await DataService.query(
          'DELETE FROM signature_fields WHERE workflow_id = $1',
          [workflowId]
        );
      }

      for (const f of data.fields) {
        const recipientId = recipients[f.recipient_index]?.id;
        if (!recipientId) continue;
        const field = await DataService.queryOne<SignatureField>(
          `INSERT INTO signature_fields (workflow_id, recipient_id, field_type, page, x, y, width, height, required)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [workflowId, recipientId, f.field_type, f.page, f.x, f.y, f.width, f.height, f.required !== false]
        );
        if (field) fields.push(field);
      }
    } else {
      fields = await DataService.queryAll<SignatureField>(
        'SELECT * FROM signature_fields WHERE workflow_id = $1',
        [workflowId]
      );
    }

    // Update timestamp
    await DataService.query(
      'UPDATE signing_workflows SET updated_at = NOW() WHERE id = $1',
      [workflowId]
    );

    // Log history
    await WorkflowService.logHistory(workflowId, 'updated', creatorEmail, actorIp, {
      user_agent: userAgent,
      updated_recipients: !!data.recipients,
      updated_fields: !!data.fields,
    });

    const updated = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );

    return await WorkflowService.formatWorkflowResponse(updated || workflow, recipients, fields);
  }

  // ─── Task 2: Parallel and sequential signing engine ────────────────

  /**
   * Start the signing process for a workflow.
   */
  static async startWorkflow(
    workflowId: string,
    creatorId: string,
    creatorEmail: string,
    actorIp: string,
    userAgent: string
  ): Promise<WorkflowResponse | null> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1 AND creator_id = $2',
      [workflowId, creatorId]
    );
    if (!workflow) return null;

    if (workflow.status !== 'draft') {
      throw new Error('Workflow has already been started or completed');
    }

    // Update status to active
    await DataService.query(
      "UPDATE signing_workflows SET status = 'active', updated_at = NOW() WHERE id = $1",
      [workflowId]
    );

    const recipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    if (recipients.length === 0) {
      throw new Error('Cannot start workflow with no recipients');
    }

    // Generate signing tokens for all recipients
    const recipientIds = recipients.map(r => r.id);
    await SigningTokenService.generateTokensForWorkflow(workflowId, recipientIds);

    // Log token generation
    await WorkflowService.logHistory(workflowId, 'token_generated', creatorEmail, actorIp, {
      user_agent: userAgent,
      recipient_count: recipientIds.length,
    });

    // Notify recipients based on workflow type
    if (workflow.workflow_type === 'parallel') {
      // Notify all recipients at once via email with signing links
      for (const recipient of recipients) {
        await WorkflowService.sendSigningEmail(workflow, recipient);
        await WorkflowService.notifyRecipient(workflow, recipient);
      }
    } else {
      // Sequential: only notify the first (lowest signing_order) pending recipient
      const firstRecipient = recipients.find(r => r.status === 'pending');
      if (firstRecipient) {
        await WorkflowService.sendSigningEmail(workflow, firstRecipient);
        await WorkflowService.notifyRecipient(workflow, firstRecipient);
      }
    }

    // Log history
    await WorkflowService.logHistory(workflowId, 'started', creatorEmail, actorIp, {
      user_agent: userAgent,
      workflow_type: workflow.workflow_type,
      notified_count: workflow.workflow_type === 'parallel' ? recipients.length : 1,
    });

    const fields = await DataService.queryAll<SignatureField>(
      'SELECT * FROM signature_fields WHERE workflow_id = $1',
      [workflowId]
    );

    const updatedWorkflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );

    return await WorkflowService.formatWorkflowResponse(updatedWorkflow || workflow, recipients, fields);
  }

  /**
   * Sign by current recipient. Enforces order for sequential workflows.
   */
  static async signWorkflow(
    workflowId: string,
    signerEmail: string,
    actorIp: string,
    userAgent: string
  ): Promise<WorkflowStatusResponse | null> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );
    if (!workflow) return null;

    if (workflow.status !== 'active') {
      throw new Error('Workflow is not active');
    }

    const recipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    const recipient = recipients.find(r => r.signer_email === signerEmail);
    if (!recipient) {
      throw new Error('You are not a recipient of this workflow');
    }

    if (recipient.status === 'signed') {
      throw new Error('You have already signed this workflow');
    }

    if (recipient.status === 'declined') {
      throw new Error('You have already declined this workflow');
    }

    // For sequential workflows, check if it's this recipient's turn
    if (workflow.workflow_type === 'sequential') {
      const pendingBefore = recipients.filter(
        r => r.signing_order < recipient.signing_order && r.status === 'pending'
      );
      if (pendingBefore.length > 0) {
        throw new Error('It is not your turn to sign yet');
      }
    }

    // Mark as signed
    await DataService.query(
      "UPDATE workflow_recipients SET status = 'signed', signed_at = NOW() WHERE id = $1",
      [recipient.id]
    );

    // Log history
    await WorkflowService.logHistory(workflowId, 'signed', signerEmail, actorIp, {
      user_agent: userAgent,
      recipient_id: recipient.id,
      signing_order: recipient.signing_order,
      timestamp: new Date().toISOString(),
    });

    // Refresh recipients
    const updatedRecipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    // Check if all have signed - auto-complete
    const allSigned = updatedRecipients.every(r => r.status === 'signed');
    if (allSigned) {
      const completedAt = new Date().toISOString();
      await DataService.query(
        "UPDATE signing_workflows SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1",
        [workflowId]
      );

      await WorkflowService.logHistory(workflowId, 'completed', signerEmail, actorIp, {
        user_agent: userAgent,
        completed_at: completedAt,
      });

      // Notify creator
      await NotificationService.create(
        workflow.creator_id,
        'workflow_completed',
        `All recipients have signed the workflow for document ${workflow.document_id}`
      );

      // ─── Post-completion: generate signed PDF, certificate, upload, email ───
      await WorkflowService.handleWorkflowCompletion(workflowId, workflow.creator_id, workflow.document_id, updatedRecipients);
    } else if (workflow.workflow_type === 'sequential') {
      // Notify the next pending recipient
      const nextRecipient = updatedRecipients.find(r => r.status === 'pending');
      if (nextRecipient) {
        await WorkflowService.notifyRecipient(workflow, nextRecipient);
      }
    }

    const finalWorkflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );

    return WorkflowService.formatStatusResponse(finalWorkflow || workflow, updatedRecipients);
  }

  /**
   * Decline signing by current recipient.
   */
  static async declineWorkflow(
    workflowId: string,
    signerEmail: string,
    actorIp: string,
    userAgent: string,
    reason?: string
  ): Promise<WorkflowStatusResponse | null> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );
    if (!workflow) return null;

    if (workflow.status !== 'active') {
      throw new Error('Workflow is not active');
    }

    const recipient = await DataService.queryOne<WorkflowRecipient>(
      "SELECT * FROM workflow_recipients WHERE workflow_id = $1 AND signer_email = $2 AND status = 'pending'",
      [workflowId, signerEmail]
    );
    if (!recipient) {
      throw new Error('You are not a pending recipient of this workflow');
    }

    await DataService.query(
      "UPDATE workflow_recipients SET status = 'declined' WHERE id = $1",
      [recipient.id]
    );

    await WorkflowService.logHistory(workflowId, 'declined', signerEmail, actorIp, {
      user_agent: userAgent,
      recipient_id: recipient.id,
      reason: reason || '',
      timestamp: new Date().toISOString(),
    });

    // Notify creator
    await NotificationService.create(
      workflow.creator_id,
      'workflow_declined',
      `${signerEmail} has declined to sign document ${workflow.document_id}`
    );

    const updatedRecipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    return WorkflowService.formatStatusResponse(workflow, updatedRecipients);
  }

  /**
   * Get real-time status of all signers in a workflow.
   */
  static async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse | null> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );
    if (!workflow) return null;

    const recipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    return WorkflowService.formatStatusResponse(workflow, recipients);
  }

  // ─── Cancel active workflow (TK-2269) ──────────────────────────────

  /**
   * Cancel a workflow that is in draft or active status.
   */
  static async cancelWorkflow(
    workflowId: string,
    creatorId: string,
    creatorEmail: string,
    actorIp: string,
    userAgent: string
  ): Promise<WorkflowResponse> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1 AND creator_id = $2',
      [workflowId, creatorId]
    );
    if (!workflow) {
      throw new Error('Workflow not found or not authorized');
    }

    if (workflow.status !== 'draft' && workflow.status !== 'active') {
      throw new Error('Can only cancel workflows in draft or active status');
    }

    // Set workflow status to cancelled
    await DataService.query(
      "UPDATE signing_workflows SET status = 'cancelled', updated_at = NOW() WHERE id = $1",
      [workflowId]
    );

    // Invalidate all signing tokens
    await DataService.query(
      'UPDATE signing_tokens SET used = true WHERE workflow_id = $1 AND used = false',
      [workflowId]
    );

    // Get pending recipients for notifications
    const pendingRecipients = await DataService.queryAll<WorkflowRecipient>(
      "SELECT * FROM workflow_recipients WHERE workflow_id = $1 AND status = 'pending' ORDER BY signing_order ASC",
      [workflowId]
    );

    // Send cancellation email and in-app notification to each pending recipient
    for (const recipient of pendingRecipients) {
      const subject = `Signing request cancelled for workflow ${workflowId}`;
      const htmlBody = `<p>Hello ${recipient.signer_name || recipient.signer_email},</p>
        <p>The signing request you received for workflow ${workflowId} has been cancelled by the sender (${creatorEmail}).</p>
        <p>No further action is required on your part.</p>`;
      await EmailService.send(recipient.signer_email, subject, htmlBody);

      // Create in-app notification for the recipient
      const user = await DataService.queryOne<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [recipient.signer_email]
      );
      if (user) {
        await NotificationService.create(
          user.id,
          'workflow_cancelled',
          `The signing request for workflow ${workflowId} has been cancelled by ${creatorEmail}.`
        );
      }
    }

    // Log history event
    await WorkflowService.logHistory(workflowId, 'cancelled', creatorEmail, actorIp, {
      user_agent: userAgent,
      previous_status: workflow.status,
      pending_recipients: pendingRecipients.length,
    });

    // Return updated workflow response
    const updatedWorkflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );

    const allRecipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    const fields = await DataService.queryAll<SignatureField>(
      'SELECT * FROM signature_fields WHERE workflow_id = $1',
      [workflowId]
    );

    return await WorkflowService.formatWorkflowResponse(updatedWorkflow || workflow, allRecipients, fields);
  }

  // ─── Task 3: Signing notification and reminder API ─────────────────

  /**
   * Manually send reminder to pending signers in a workflow.
   * If recipientId is provided, only send to that specific recipient.
   * Otherwise, send to all pending recipients.
   */
  static async sendReminders(
    workflowId: string,
    creatorId: string,
    creatorEmail: string,
    actorIp: string,
    userAgent: string,
    recipientId?: string
  ): Promise<{ reminded: string[] }> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1 AND creator_id = $2',
      [workflowId, creatorId]
    );
    if (!workflow) {
      throw new Error('Workflow not found or not authorized');
    }

    if (workflow.status !== 'active') {
      throw new Error('Can only send reminders for active workflows');
    }

    let pendingRecipients: WorkflowRecipient[];
    if (recipientId) {
      // Send only to the specific recipient
      pendingRecipients = await DataService.queryAll<WorkflowRecipient>(
        "SELECT * FROM workflow_recipients WHERE workflow_id = $1 AND id = $2 AND status = 'pending'",
        [workflowId, recipientId]
      );
      if (pendingRecipients.length === 0) {
        throw new Error('Recipient not found or not in pending status');
      }
    } else {
      pendingRecipients = await DataService.queryAll<WorkflowRecipient>(
        "SELECT * FROM workflow_recipients WHERE workflow_id = $1 AND status = 'pending' ORDER BY signing_order ASC",
        [workflowId]
      );
    }

    const reminded: string[] = [];
    for (const recipient of pendingRecipients) {
      await WorkflowService.sendSigningEmail(workflow, recipient, true);
      await WorkflowService.notifyRecipient(workflow, recipient, true);
      reminded.push(recipient.signer_email);

      // Update reminder tracking
      await DataService.query(
        `UPDATE workflow_reminders SET last_sent_at = NOW(), next_send_at = NOW() + (reminder_interval_hours || ' hours')::interval
         WHERE workflow_id = $1 AND recipient_id = $2`,
        [workflowId, recipient.id]
      );

      await WorkflowService.logHistory(workflowId, 'reminder_sent', creatorEmail, actorIp, {
        user_agent: userAgent,
        recipient_email: recipient.signer_email,
        recipient_id: recipient.id,
      });
    }

    return { reminded };
  }

  /**
   * Configure reminder intervals for workflow recipients.
   */
  static async configureReminders(
    workflowId: string,
    creatorId: string,
    reminderIntervalHours: number,
    recipientIds?: string[]
  ): Promise<WorkflowReminder[]> {
    const workflow = await DataService.queryOne<SigningWorkflow>(
      'SELECT * FROM signing_workflows WHERE id = $1 AND creator_id = $2',
      [workflowId, creatorId]
    );
    if (!workflow) {
      throw new Error('Workflow not found or not authorized');
    }

    let recipients: WorkflowRecipient[];
    if (recipientIds && recipientIds.length > 0) {
      recipients = await DataService.queryAll<WorkflowRecipient>(
        'SELECT * FROM workflow_recipients WHERE workflow_id = $1 AND id = ANY($2)',
        [workflowId, recipientIds]
      );
    } else {
      recipients = await DataService.queryAll<WorkflowRecipient>(
        'SELECT * FROM workflow_recipients WHERE workflow_id = $1',
        [workflowId]
      );
    }

    const reminders: WorkflowReminder[] = [];
    for (const recipient of recipients) {
      // Upsert reminder configuration
      const reminder = await DataService.queryOne<WorkflowReminder>(
        `INSERT INTO workflow_reminders (workflow_id, recipient_id, reminder_interval_hours, next_send_at)
         VALUES ($1, $2, $3::int, NOW() + make_interval(hours => $3::int))
         ON CONFLICT (workflow_id, recipient_id)
         DO UPDATE SET reminder_interval_hours = $3::int,
                       next_send_at = NOW() + make_interval(hours => $3::int)
         RETURNING *`,
        [workflowId, recipient.id, reminderIntervalHours]
      );
      if (reminder) reminders.push(reminder);
    }

    return reminders;
  }

  // ─── Task 4: Workflow action history ───────────────────────────────

  /**
   * Log a workflow action for compliance tracking.
   */
  static async logHistory(
    workflowId: string,
    action: WorkflowAction,
    actorEmail: string,
    actorIp: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await DataService.query(
      `INSERT INTO workflow_history (workflow_id, action, actor_email, actor_ip, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [workflowId, action, actorEmail, actorIp, JSON.stringify(metadata)]
    );
  }

  /**
   * Get full workflow history with compliance metadata.
   */
  static async getHistory(workflowId: string): Promise<WorkflowHistoryResponse[]> {
    const history = await DataService.queryAll<WorkflowHistory>(
      'SELECT * FROM workflow_history WHERE workflow_id = $1 ORDER BY created_at ASC',
      [workflowId]
    );

    return history.map((h): WorkflowHistoryResponse => ({
      id: h.id,
      workflow_id: h.workflow_id,
      action: h.action,
      actor_email: h.actor_email,
      actor_ip: h.actor_ip,
      metadata: typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata,
      created_at: h.created_at instanceof Date ? h.created_at.toISOString() : String(h.created_at),
    }));
  }

  // ─── Signing email with token link ─────────────────────────────────

  /**
   * Send a signing request email with a direct signing URL to a recipient.
   */
  static async sendSigningEmail(
    workflow: SigningWorkflow,
    recipient: WorkflowRecipient,
    isReminder: boolean = false
  ): Promise<void> {
    try {
      // Get or generate token for this recipient
      let signingToken = await SigningTokenService.getTokenByRecipient(workflow.id, recipient.id);
      if (!signingToken) {
        signingToken = await SigningTokenService.generateToken(workflow.id, recipient.id);
      }

      // Get document info
      const document = await DataService.queryOne<{ original_name: string }>(
        'SELECT original_name FROM documents WHERE id = $1',
        [workflow.document_id]
      );

      // Get sender info
      const sender = await DataService.queryOne<{ name: string; email: string }>(
        'SELECT name, email FROM users WHERE id = $1',
        [workflow.creator_id]
      );

      // Count fields for this recipient
      const fieldCount = await DataService.queryOne<{ count: string }>(
        'SELECT COUNT(*) as count FROM signature_fields WHERE workflow_id = $1 AND recipient_id = $2',
        [workflow.id, recipient.id]
      );

      const documentName = document?.original_name || 'Document';
      const senderName = sender?.name || sender?.email || 'Someone';
      const senderEmail = sender?.email || '';
      const fieldsToSign = parseInt(fieldCount?.count || '0', 10);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const signingUrl = `${frontendUrl}/sign-document/${signingToken.token}`;

      const subject = isReminder
        ? `Reminder: ${senderName} needs your signature on "${documentName}"`
        : `${senderName} has requested your signature on "${documentName}"`;

      const htmlBody = WorkflowService.buildSigningEmailTemplate({
        recipientName: recipient.signer_name || recipient.signer_email,
        senderName,
        senderEmail,
        documentName,
        signingUrl,
        fieldsToSign,
        isReminder,
        expiresAt: signingToken.expires_at,
      });

      await EmailService.send(recipient.signer_email, subject, htmlBody);
    } catch (error) {
      console.error('Failed to send signing email:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Build an HTML email template for signing requests.
   */
  private static buildSigningEmailTemplate(params: {
    recipientName: string;
    senderName: string;
    senderEmail: string;
    documentName: string;
    signingUrl: string;
    fieldsToSign: number;
    isReminder: boolean;
    expiresAt: Date;
  }): string {
    const expiresDate = params.expiresAt instanceof Date
      ? params.expiresAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date(params.expiresAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color: #1a56db; padding: 24px 32px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">eDocs</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              ${params.isReminder ? '<p style="color: #d97706; font-weight: 600; margin: 0 0 16px;">Reminder</p>' : ''}
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 16px;">
                Hello ${params.recipientName},
              </p>
              <p style="color: #374151; font-size: 16px; line-height: 1.5; margin: 0 0 24px;">
                <strong>${params.senderName}</strong>${params.senderEmail ? ` (${params.senderEmail})` : ''} has
                ${params.isReminder ? 'sent you a reminder to' : 'requested you to'} sign the following document:
              </p>
              <!-- Document Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 8px; color: #111827; font-size: 18px; font-weight: 600;">
                      ${params.documentName}
                    </p>
                    <p style="margin: 0; color: #6b7280; font-size: 14px;">
                      ${params.fieldsToSign} field${params.fieldsToSign !== 1 ? 's' : ''} to sign
                    </p>
                    <p style="margin: 8px 0 0; color: #6b7280; font-size: 14px;">
                      Expires: ${expiresDate}
                    </p>
                  </td>
                </tr>
              </table>
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${params.signingUrl}"
                       style="display: inline-block; background-color: #1a56db; color: #ffffff; text-decoration: none; padding: 14px 40px; border-radius: 6px; font-size: 16px; font-weight: 600;">
                      Sign Document
                    </a>
                  </td>
                </tr>
              </table>
              <p style="color: #9ca3af; font-size: 13px; line-height: 1.5; margin: 0;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${params.signingUrl}" style="color: #1a56db; word-break: break-all;">${params.signingUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 20px 32px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; line-height: 1.5; margin: 0;">
                This is an automated notification from eDocs. If you did not expect this email, please disregard it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ─── Post-completion: Signed PDF, Certificate, S3, Email ───────────

  /**
   * Handle post-sign: check completion, notify creator of progress, email next signer.
   * Called from all signing paths (self-sign, token-sign, signWorkflow).
   */
  static async handlePostSign(
    workflow: SigningWorkflow,
    signerEmail: string,
    actorIp: string,
    userAgent: string
  ): Promise<{ allSigned: boolean }> {
    const allRecipients = await DataService.queryAll<WorkflowRecipient>(
      'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflow.id]
    );

    const allSigned = allRecipients.every(r => r.status === 'signed');
    const signedCount = allRecipients.filter(r => r.status === 'signed').length;
    const totalCount = allRecipients.length;

    if (allSigned) {
      // Mark workflow completed
      await DataService.query(
        "UPDATE signing_workflows SET status = 'completed', updated_at = NOW() WHERE id = $1",
        [workflow.id]
      );

      await WorkflowService.logHistory(workflow.id, 'completed', signerEmail, actorIp, {
        user_agent: userAgent,
        completed_at: new Date().toISOString(),
      });

      await NotificationService.create(
        workflow.creator_id,
        'workflow_completed',
        `All recipients have signed the workflow for document ${workflow.document_id}`
      );

      // Generate signed PDF, certificate, email all parties
      await WorkflowService.handleWorkflowCompletion(workflow.id, workflow.creator_id, workflow.document_id, allRecipients);
    } else {
      // Not all signed yet — notify creator of progress
      const pending = allRecipients.filter(r => r.status === 'pending').map(r => r.signer_name || r.signer_email);
      const document = await DataService.queryOne<{ original_name: string }>(
        'SELECT original_name FROM documents WHERE id = $1',
        [workflow.document_id]
      );
      const docName = document?.original_name || 'Document';

      // In-app notification to creator
      await NotificationService.create(
        workflow.creator_id,
        'signature_completed',
        `${signerEmail} has signed "${docName}" (${signedCount}/${totalCount}). Waiting for: ${pending.join(', ')}`
      );

      // Email creator about progress
      const creator = await DataService.queryOne<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE id = $1',
        [workflow.creator_id]
      );
      if (creator?.email && creator.email !== signerEmail) {
        await EmailService.send(
          creator.email,
          `Signing Update: ${signerEmail} signed "${docName}"`,
          WorkflowService.buildProgressEmailTemplate(docName, signerEmail, signedCount, totalCount, pending)
        );
      }

      // Sequential: email next signer
      if (workflow.workflow_type === 'sequential') {
        const nextRecipient = allRecipients.find(r => r.status === 'pending');
        if (nextRecipient) {
          await WorkflowService.sendSigningEmail(workflow, nextRecipient);
        }
      }
    }

    return { allSigned };
  }

  /**
   * Build progress notification email HTML.
   */
  private static buildProgressEmailTemplate(
    docName: string,
    signerEmail: string,
    signedCount: number,
    totalCount: number,
    pending: string[]
  ): string {
    return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <h2 style="color:#4f46e5;margin:0 0 16px">eDocSign</h2>
      <p style="color:#374151;font-size:16px;line-height:1.5">
        <strong>${signerEmail}</strong> has signed <strong>${docName}</strong>.
      </p>
      <div style="background:#f3f4f6;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0;color:#374151;font-size:14px">
          <strong>Progress:</strong> ${signedCount} of ${totalCount} signatures complete
        </p>
        <div style="background:#e5e7eb;border-radius:4px;height:8px;margin:8px 0">
          <div style="background:#4f46e5;border-radius:4px;height:8px;width:${Math.round((signedCount / totalCount) * 100)}%"></div>
        </div>
        <p style="margin:8px 0 0;color:#6b7280;font-size:13px">
          Waiting for: ${pending.join(', ')}
        </p>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:24px">This is an automated notification from eDocSign.</p>
    </div>`;
  }

  /**
   * Process all completed workflows that are missing signed PDFs or certificates.
   * Called on server startup and can be triggered via API.
   */
  static async processIncompleteCompletions(): Promise<{ processed: number; errors: string[] }> {
    const errors: string[] = [];
    let processed = 0;

    const incomplete = await DataService.queryAll<SigningWorkflow>(
      `SELECT * FROM signing_workflows
       WHERE status = 'completed'
       AND (signed_pdf_path IS NULL OR signed_pdf_path = '' OR certificate_pdf_path IS NULL OR certificate_pdf_path = '')`,
      []
    );

    console.log(`Found ${incomplete.length} completed workflows missing signed PDF/certificate`);

    for (const workflow of incomplete) {
      try {
        const recipients = await DataService.queryAll<WorkflowRecipient>(
          'SELECT * FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
          [workflow.id]
        );

        await WorkflowService.handleWorkflowCompletion(workflow.id, workflow.creator_id, workflow.document_id, recipients);
        processed++;
        console.log(`Processed workflow ${workflow.id}: signed PDF + certificate generated and emails sent`);
      } catch (error) {
        const msg = `Workflow ${workflow.id}: ${error instanceof Error ? error.message : error}`;
        console.error('Completion processing failed:', msg);
        errors.push(msg);
      }
    }

    // Workflows that already have signed_pdf_path and certificate_pdf_path
    // are considered fully processed — no re-send needed.

    return { processed, errors };
  }

  /**
   * Handle workflow completion: generate signed PDF & certificate,
   * upload to S3 (if configured), email all parties with download links,
   * and create in-app notifications.
   */
  static async handleWorkflowCompletion(
    workflowId: string,
    creatorId: string,
    documentId: string,
    recipients: WorkflowRecipient[]
  ): Promise<void> {
    try {
      // 1. Generate signed PDF (uploads to S3 internally)
      const signedPdfPath = await PdfSigningService.generateSignedPdf(workflowId);
      console.log(`Signed PDF generated: ${signedPdfPath}`);

      // 2. Generate signing certificate (uploads to S3 internally)
      const certificatePath = await CertificateService.generateCertificate(workflowId);
      console.log(`Certificate generated: ${certificatePath}`);

      // 3. Get download URLs from S3
      const signedPdfUrl = await StorageService.getUrl(signedPdfPath);
      const certificateUrl = await StorageService.getUrl(certificatePath);

      // 5. Gather all email addresses: recipients + document owner
      const creator = await DataService.queryOne<{ email: string; name: string }>(
        'SELECT email, name FROM users WHERE id = $1',
        [creatorId]
      );

      const document = await DataService.queryOne<{ original_name: string }>(
        'SELECT original_name FROM documents WHERE id = $1',
        [documentId]
      );

      const documentName = document?.original_name || 'Document';

      const allEmails: string[] = [];
      if (creator?.email) {
        allEmails.push(creator.email);
      }
      for (const r of recipients) {
        if (r.signer_email && !allEmails.includes(r.signer_email)) {
          allEmails.push(r.signer_email);
        }
      }

      // 6. Send email to all parties with download portal link
      if (allEmails.length > 0) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        const portalUrl = `${frontendUrl}/workflows/${workflowId}/downloads`;

        const signerRows = recipients.map(r => {
          const signedDate = r.signed_at ? new Date(r.signed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Pending';
          return `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.signer_name || r.signer_email}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;">${signedDate}</td></tr>`;
        }).join('');

        const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
    <div style="background:#2563eb;color:#fff;padding:24px;text-align:center;">
      <h1 style="margin:0;font-size:22px;">Document Fully Signed</h1>
    </div>
    <div style="padding:24px;">
      <p style="font-size:16px;color:#333;">All parties have signed <strong>${documentName}</strong>.</p>
      <p style="font-size:14px;color:#555;">Log in to eDocSign to download your signed document and certificate.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${portalUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:16px;font-weight:bold;">Download Documents</a>
      </div>
      <h3 style="margin:20px 0 10px;font-size:14px;color:#333;">Signers</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead><tr style="background:#f9fafb;"><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #eee;">Name</th><th style="padding:8px 12px;text-align:left;border-bottom:2px solid #eee;">Signed</th></tr></thead>
        <tbody>${signerRows}</tbody>
      </table>
      <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
      <p style="font-size:12px;color:#999;text-align:center;">Don't have an account? <a href="${frontendUrl}" style="color:#2563eb;">Create one for free</a> to access your documents.</p>
    </div>
  </div>
</body>
</html>`;

        const subject = `Document Signed: ${documentName}`;
        let sent = 0;
        const emailErrors: string[] = [];
        for (const email of allEmails) {
          const result = await EmailService.send(email, subject, htmlBody);
          if (result.success) {
            sent++;
          } else {
            emailErrors.push(result.error || `Failed to send to ${email}`);
          }
        }
        console.log(`Signed document email sent to ${sent}/${allEmails.length} recipients`);
        if (emailErrors.length > 0) {
          console.warn('Email delivery errors:', emailErrors);
        }
      }

      // 7. Create in-app notifications for all parties with download links
      // Notify creator
      await NotificationService.create(
        creatorId,
        'document_signed',
        `All parties have signed "${documentName}". Download the signed document and certificate.`,
        signedPdfUrl
      );

      // Notify each recipient (if they have user accounts)
      for (const r of recipients) {
        const user = await DataService.queryOne<{ id: string }>(
          'SELECT id FROM users WHERE email = $1',
          [r.signer_email]
        );
        if (user) {
          await NotificationService.create(
            user.id,
            'document_signed',
            `"${documentName}" has been fully signed by all parties. Download the signed document and certificate.`,
            signedPdfUrl
          );
        }
      }
    } catch (error) {
      // Don't fail the signing operation if post-completion tasks fail
      console.error('Post-completion processing error:', error instanceof Error ? error.message : error);
    }
  }

  // ─── Private helpers ───────────────────────────────────────────────

  /**
   * Send a notification to a recipient that it's their turn to sign.
   */
  private static async notifyRecipient(
    workflow: SigningWorkflow,
    recipient: WorkflowRecipient,
    isReminder: boolean = false
  ): Promise<void> {
    // Look up user by email to get user_id for notification
    const user = await DataService.queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [recipient.signer_email]
    );

    if (user) {
      const messagePrefix = isReminder ? 'Reminder: ' : '';
      await NotificationService.create(
        user.id,
        isReminder ? 'signing_reminder' : 'signing_request',
        `${messagePrefix}You have a document to sign (workflow ${workflow.id})`
      );
    }
  }

  private static async getDocumentName(documentId: string): Promise<string> {
    const doc = await DataService.queryOne<{ original_name: string }>(
      'SELECT original_name FROM documents WHERE id = $1',
      [documentId]
    );
    return doc?.original_name || '';
  }

  private static async formatWorkflowResponse(
    workflow: SigningWorkflow,
    recipients: WorkflowRecipient[],
    fields: SignatureField[]
  ): Promise<WorkflowResponse> {
    const documentName = await WorkflowService.getDocumentName(workflow.document_id);
    return {
      id: workflow.id,
      document_id: workflow.document_id,
      document_name: documentName,
      creator_id: workflow.creator_id,
      workflow_type: workflow.workflow_type,
      status: workflow.status,
      recipients: recipients.map(WorkflowService.formatRecipient),
      fields: fields.map((f): SignatureFieldResponse => ({
        id: f.id,
        recipient_id: f.recipient_id,
        field_type: f.field_type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required !== false,
      })),
      created_at: workflow.created_at instanceof Date ? workflow.created_at.toISOString() : String(workflow.created_at),
      updated_at: workflow.updated_at instanceof Date ? workflow.updated_at.toISOString() : String(workflow.updated_at),
    };
  }

  private static formatRecipient(r: WorkflowRecipient): WorkflowRecipientResponse {
    return {
      id: r.id,
      signer_email: r.signer_email,
      signer_name: r.signer_name,
      signing_order: r.signing_order,
      status: r.status,
      signed_at: r.signed_at instanceof Date ? r.signed_at.toISOString() : r.signed_at ? String(r.signed_at) : null,
    };
  }

  private static formatStatusResponse(
    workflow: SigningWorkflow,
    recipients: WorkflowRecipient[]
  ): WorkflowStatusResponse {
    const formattedRecipients = recipients.map(WorkflowService.formatRecipient);
    return {
      workflow_id: workflow.id,
      workflow_type: workflow.workflow_type,
      status: workflow.status,
      recipients: formattedRecipients,
      progress: {
        total: recipients.length,
        signed: recipients.filter(r => r.status === 'signed').length,
        pending: recipients.filter(r => r.status === 'pending').length,
        declined: recipients.filter(r => r.status === 'declined').length,
      },
    };
  }
}

export default WorkflowService;
