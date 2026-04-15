import { Response } from 'express';
import { WorkflowService } from '../services/workflowService';
import { AuthenticatedRequest } from '../middleware/auth';
import { CreateWorkflowRequest, UpdateWorkflowRequest, ConfigureRemindersRequest } from '../types/workflow';

/**
 * WorkflowController handles HTTP requests for signing workflow endpoints (EP-247).
 */
export class WorkflowController {
  /**
   * Create a new signing workflow.
   * POST /api/workflows
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { document_id, workflow_type, recipients: rawRecipients, signature_fields } = req.body;

      if (!document_id || !workflow_type || !rawRecipients || rawRecipients.length === 0) {
        res.status(400).json({
          success: false,
          error: 'document_id, workflow_type, and at least one recipient are required',
        });
        return;
      }

      if (!['parallel', 'sequential'].includes(workflow_type)) {
        res.status(400).json({ success: false, error: 'workflow_type must be parallel or sequential' });
        return;
      }

      // Map client format (email/name/order) to server format (signer_email/signer_name/signing_order)
      const recipients = rawRecipients.map((r: any) => ({
        signer_email: r.signer_email || r.email,
        signer_name: r.signer_name || r.name,
        signing_order: r.signing_order ?? r.order ?? 1,
      }));

      // Map client signature_fields to server fields format
      const fields = signature_fields?.map((f: any) => ({
        recipient_index: f.recipient_index,
        field_type: f.field_type || f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required,
        label: f.label ?? null,
      }));

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const workflow = await WorkflowService.createWorkflow(
        req.userId,
        req.userEmail,
        { document_id, workflow_type, recipients, fields },
        actorIp,
        userAgent
      );

      res.status(201).json({ success: true, data: { workflow } });
    } catch (error: any) {
      console.error('Create workflow error:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * List all workflows for the authenticated user.
   * GET /api/workflows
   */
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }
      const workflows = await WorkflowService.listWorkflows(req.userId, req.userEmail);
      res.status(200).json({ success: true, data: { workflows } });
    } catch (error: any) {
      console.error('List workflows error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get workflow details.
   * GET /api/workflows/:id
   */
  static async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const workflow = await WorkflowService.getWorkflow(req.params.id);
      if (!workflow) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      res.status(200).json({ success: true, data: { workflow } });
    } catch (error: any) {
      console.error('Get workflow error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Update workflow recipients/order/fields.
   * PUT /api/workflows/:id
   */
  static async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { recipients, fields }: UpdateWorkflowRequest = req.body;

      if (!recipients && !fields) {
        res.status(400).json({ success: false, error: 'At least recipients or fields must be provided' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const workflow = await WorkflowService.updateWorkflow(
        req.params.id,
        req.userId,
        req.userEmail,
        { recipients, fields },
        actorIp,
        userAgent
      );

      if (!workflow) {
        res.status(404).json({ success: false, error: 'Workflow not found or not authorized' });
        return;
      }

      res.status(200).json({ success: true, data: { workflow } });
    } catch (error: any) {
      console.error('Update workflow error:', error);
      const status = error.message?.includes('not in draft') ? 409 : 500;
      res.status(status).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * Start the signing process.
   * POST /api/workflows/:id/start
   */
  static async start(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const workflow = await WorkflowService.startWorkflow(
        req.params.id,
        req.userId,
        req.userEmail,
        actorIp,
        userAgent
      );

      if (!workflow) {
        res.status(404).json({ success: false, error: 'Workflow not found or not authorized' });
        return;
      }

      res.status(200).json({ success: true, data: { workflow } });
    } catch (error: any) {
      console.error('Start workflow error:', error);
      const status = error.message?.includes('already been started') ? 409 : 500;
      res.status(status).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * Sign by current recipient.
   * PATCH /api/workflows/:id/sign
   */
  static async sign(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const status = await WorkflowService.signWorkflow(
        req.params.id,
        req.userEmail,
        actorIp,
        userAgent
      );

      if (!status) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      res.status(200).json({ success: true, data: { status } });
    } catch (error: any) {
      console.error('Sign workflow error:', error);
      let httpStatus = 500;
      if (error.message?.includes('not active')) httpStatus = 409;
      if (error.message?.includes('not a recipient')) httpStatus = 403;
      if (error.message?.includes('already signed') || error.message?.includes('already declined')) httpStatus = 409;
      if (error.message?.includes('not your turn')) httpStatus = 409;
      res.status(httpStatus).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * Decline signing.
   * PATCH /api/workflows/:id/decline
   */
  static async decline(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const { reason } = req.body;

      const status = await WorkflowService.declineWorkflow(
        req.params.id,
        req.userEmail,
        actorIp,
        userAgent,
        reason
      );

      if (!status) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      res.status(200).json({ success: true, data: { status } });
    } catch (error: any) {
      console.error('Decline workflow error:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * Get workflow status.
   * GET /api/workflows/:id/status
   */
  static async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const status = await WorkflowService.getWorkflowStatus(req.params.id);
      if (!status) {
        res.status(404).json({ success: false, error: 'Workflow not found' });
        return;
      }

      res.status(200).json({ success: true, data: { status } });
    } catch (error: any) {
      console.error('Get workflow status error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Cancel an active or draft workflow.
   * POST /api/workflows/:id/cancel
   */
  static async cancel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const workflow = await WorkflowService.cancelWorkflow(
        req.params.id,
        req.userId,
        req.userEmail,
        actorIp,
        userAgent
      );

      res.status(200).json({ success: true, data: { workflow } });
    } catch (error: any) {
      console.error('Cancel workflow error:', error);
      const status = error.message?.includes('not found') ? 404
        : error.message?.includes('only cancel') ? 409
        : 500;
      res.status(status).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * Send reminders to pending signers.
   * POST /api/workflows/:id/remind
   */
  static async sendReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId || !req.userEmail) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const actorIp = req.ip || req.socket?.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';
      const { recipientId } = req.body;

      const result = await WorkflowService.sendReminders(
        req.params.id,
        req.userId,
        req.userEmail,
        actorIp,
        userAgent,
        recipientId
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Send reminders error:', error);
      const status = error.message?.includes('not found') ? 404 : 500;
      res.status(status).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * Configure reminder intervals.
   * PUT /api/workflows/:id/reminders
   */
  static async configureReminders(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const body = req.body as ConfigureRemindersRequest & {
        reminders?: { signer_id: string; interval_hours: number }[];
      };

      // New per-signer shape from the UI: { reminders: [{ signer_id, interval_hours }] }
      if (Array.isArray(body.reminders)) {
        const invalid = body.reminders.find(
          (r) => !r.signer_id || !Number.isFinite(r.interval_hours) || r.interval_hours < 1
        );
        if (invalid) {
          res.status(400).json({ success: false, error: 'Each reminder interval must be at least 1 hour' });
          return;
        }
        const all: any[] = [];
        for (const r of body.reminders) {
          const result = await WorkflowService.configureReminders(
            req.params.id,
            req.userId,
            r.interval_hours,
            [r.signer_id]
          );
          all.push(...result);
        }
        res.status(200).json({ success: true, data: { reminders: all } });
        return;
      }

      // Legacy shape: { reminder_interval_hours, recipient_ids }
      const { reminder_interval_hours, recipient_ids } = body;
      if (!reminder_interval_hours || reminder_interval_hours < 1) {
        res.status(400).json({ success: false, error: 'reminder_interval_hours must be at least 1' });
        return;
      }

      const reminders = await WorkflowService.configureReminders(
        req.params.id,
        req.userId,
        reminder_interval_hours,
        recipient_ids
      );

      res.status(200).json({ success: true, data: { reminders } });
    } catch (error: any) {
      console.error('Configure reminders error:', error);
      res.status(500).json({ success: false, error: error.message || 'Internal server error' });
    }
  }

  /**
   * Get workflow action history.
   * GET /api/workflows/:id/history
   */
  static async getHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const history = await WorkflowService.getHistory(req.params.id);

      res.status(200).json({ success: true, data: { history } });
    } catch (error: any) {
      console.error('Get workflow history error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default WorkflowController;
