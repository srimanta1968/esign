import { Router, Response, RequestHandler } from 'express';
import { WorkflowController } from '../controllers/workflowController';
import { SigningController } from '../controllers/signingController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { checkPlanLimit } from '../middleware/planLimits';
import { DataService } from '../services/DataService';
import { StorageService } from '../services/storageService';
// @governance-tracked — API definitions added for EP-247 Signature Workflow Engine

/**
 * Workflow routes configuration for EP-247.
 * API Definitions: tests/api_definitions/workflows-*.json
 */

interface WorkflowRouter {
  create: RequestHandler;
  getById: RequestHandler;
  update: RequestHandler;
  start: RequestHandler;
  cancel: RequestHandler;
  sign: RequestHandler;
  decline: RequestHandler;
  getStatus: RequestHandler;
  sendReminders: RequestHandler;
  configureReminders: RequestHandler;
  getHistory: RequestHandler;
}

const workflowHandlers: WorkflowRouter = {
  create: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.create(req, res);
  },
  getById: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.getById(req, res);
  },
  update: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.update(req, res);
  },
  start: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.start(req, res);
  },
  cancel: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.cancel(req, res);
  },
  sign: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.sign(req, res);
  },
  decline: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.decline(req, res);
  },
  getStatus: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.getStatus(req, res);
  },
  sendReminders: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.sendReminders(req, res);
  },
  configureReminders: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.configureReminders(req, res);
  },
  getHistory: (req: AuthenticatedRequest, res: Response): void => {
    WorkflowController.getHistory(req, res);
  },
};

const router: Router = Router();

// Task 1: Recipient and signing order API
router.post('/', authenticateToken as RequestHandler, checkPlanLimit, workflowHandlers.create);
router.get('/', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  WorkflowController.list(req, res);
}) as RequestHandler);
// Admin: process incomplete completions
router.post('/admin/process-completions', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const { WorkflowService } = await import('../services/workflowService');
    const result = await WorkflowService.processIncompleteCompletions();
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Process completions error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

// Downloads portal endpoint
router.get('/:id/downloads', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }

    const workflowId = req.params.id;

    // Get workflow
    const workflow = await DataService.queryOne<any>(
      'SELECT * FROM signing_workflows WHERE id = $1',
      [workflowId]
    );

    if (!workflow) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    // Verify user is creator or recipient
    const creator = await DataService.queryOne<{ id: string; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE id = $1',
      [workflow.creator_id]
    );

    const isCreator = workflow.creator_id === req.userId;

    let isRecipient = false;
    if (!isCreator && req.userEmail) {
      const recipientCheck = await DataService.queryOne<{ id: string }>(
        'SELECT id FROM workflow_recipients WHERE workflow_id = $1 AND signer_email = $2',
        [workflowId, req.userEmail]
      );
      isRecipient = !!recipientCheck;
    }

    if (!isCreator && !isRecipient) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    // Check workflow is completed
    if (workflow.status !== 'completed') {
      res.status(400).json({ success: false, error: 'Workflow is not yet completed' });
      return;
    }

    // Check signed documents exist
    if (!workflow.signed_pdf_path || !workflow.certificate_pdf_path) {
      res.status(404).json({ success: false, error: 'Signed documents not yet available' });
      return;
    }

    // Get presigned URLs
    const signedPdfUrl = await StorageService.getUrl(workflow.signed_pdf_path);
    const certificateUrl = await StorageService.getUrl(workflow.certificate_pdf_path);

    // Get document info
    const document = await DataService.queryOne<{ original_name: string }>(
      'SELECT original_name FROM documents WHERE id = $1',
      [workflow.document_id]
    );

    // Get all recipients with signed_at
    const recipients = await DataService.queryAll<{ signer_name: string; signer_email: string; signed_at: string }>(
      'SELECT signer_name, signer_email, signed_at FROM workflow_recipients WHERE workflow_id = $1 ORDER BY signing_order ASC',
      [workflowId]
    );

    res.json({
      success: true,
      data: {
        document_name: document?.original_name || 'Document',
        signed_pdf_url: signedPdfUrl,
        certificate_url: certificateUrl,
        completed_at: workflow.updated_at,
        signers: recipients.map(r => ({
          name: r.signer_name,
          email: r.signer_email,
          signed_at: r.signed_at,
        })),
        creator: {
          name: creator?.name || '',
          email: creator?.email || '',
        },
      },
    });
  } catch (error: any) {
    console.error('Downloads endpoint error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

router.get('/:id', authenticateToken as RequestHandler, workflowHandlers.getById);
router.put('/:id', authenticateToken as RequestHandler, workflowHandlers.update);

// Task 2: Parallel and sequential signing engine
router.post('/:id/start', authenticateToken as RequestHandler, workflowHandlers.start);
router.post('/:id/cancel', authenticateToken as RequestHandler, workflowHandlers.cancel);
router.patch('/:id/sign', authenticateToken as RequestHandler, workflowHandlers.sign);
router.patch('/:id/decline', authenticateToken as RequestHandler, workflowHandlers.decline);
router.get('/:id/status', authenticateToken as RequestHandler, workflowHandlers.getStatus);

// Task 3: Signing notification and reminder API
router.post('/:id/remind', authenticateToken as RequestHandler, workflowHandlers.sendReminders);
router.put('/:id/reminders', authenticateToken as RequestHandler, workflowHandlers.configureReminders);

// Task 4: Workflow action history API
router.get('/:id/history', authenticateToken as RequestHandler, workflowHandlers.getHistory);

// History export (CSV/PDF)
router.get('/:id/history/export', authenticateToken as RequestHandler, (async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'User not authenticated' });
      return;
    }
    const { WorkflowService } = await import('../services/workflowService');
    const history = await WorkflowService.getHistory(req.params.id);
    const format = req.query.format || 'csv';

    // Exports should never be cached — second-click must re-download.
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');

    if (format === 'csv') {
      const header = 'Timestamp,Action,Actor,IP Address,Details\n';
      const rows = history.map((e: any) => {
        const ts = e.created_at instanceof Date ? e.created_at.toISOString() : e.created_at;
        const actor = e.actor_email || '';
        const ip = e.actor_ip || '';
        const details = e.metadata ? JSON.stringify(e.metadata).replace(/"/g, '""') : '';
        return `"${ts}","${e.action}","${actor}","${ip}","${details}"`;
      }).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="workflow-history-${req.params.id.slice(0, 8)}.csv"`);
      res.send(header + rows);
    } else {
      const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pageSize: [number, number] = [612, 792];
      const margin = 40;
      const lineHeight = 14;
      let page = pdfDoc.addPage(pageSize);
      let y = pageSize[1] - margin;

      page.drawText('Workflow Action History', { x: margin, y, size: 16, font: bold, color: rgb(0, 0, 0) });
      y -= 24;
      page.drawText(`Workflow: ${req.params.id}`, { x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      y -= lineHeight;
      page.drawText(`Exported: ${new Date().toISOString()}`, { x: margin, y, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
      y -= lineHeight * 1.5;

      const sanitize = (s: string): string => (s || '').replace(/[^\x20-\x7E]/g, '?');
      const wrap = (text: string, maxWidth: number, size: number): string[] => {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let line = '';
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (font.widthOfTextAtSize(test, size) > maxWidth) {
            if (line) lines.push(line);
            line = w;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        return lines;
      };

      for (const e of history as any[]) {
        if (y < margin + lineHeight * 3) {
          page = pdfDoc.addPage(pageSize);
          y = pageSize[1] - margin;
        }
        const ts = e.created_at instanceof Date ? e.created_at.toISOString() : String(e.created_at);
        const header = sanitize(`[${ts}] ${e.action} by ${e.actor_email || 'system'} from ${e.actor_ip || 'unknown'}`);
        for (const ln of wrap(header, pageSize[0] - margin * 2, 10)) {
          page.drawText(ln, { x: margin, y, size: 10, font, color: rgb(0, 0, 0) });
          y -= lineHeight;
        }
        if (e.metadata) {
          const details = sanitize(typeof e.metadata === 'string' ? e.metadata : JSON.stringify(e.metadata));
          for (const ln of wrap(details, pageSize[0] - margin * 2 - 12, 8)) {
            if (y < margin + lineHeight) {
              page = pdfDoc.addPage(pageSize);
              y = pageSize[1] - margin;
            }
            page.drawText(ln, { x: margin + 12, y, size: 8, font, color: rgb(0.35, 0.35, 0.35) });
            y -= lineHeight - 2;
          }
        }
        y -= 4;
      }

      const pdfBytes = await pdfDoc.save();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="workflow-history-${req.params.id.slice(0, 8)}.pdf"`);
      res.send(Buffer.from(pdfBytes));
    }
  } catch (error: any) {
    console.error('History export error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}) as RequestHandler);

// Self-signing endpoint (authenticated user signs their own fields)
router.post('/:id/self-sign', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  SigningController.selfSign(req, res);
}) as RequestHandler);

export default router;
