import { Router, Response, RequestHandler } from 'express';
import { WorkflowController } from '../controllers/workflowController';
import { SigningController } from '../controllers/signingController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
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
router.post('/', authenticateToken as RequestHandler, workflowHandlers.create);
router.get('/:id', authenticateToken as RequestHandler, workflowHandlers.getById);
router.put('/:id', authenticateToken as RequestHandler, workflowHandlers.update);

// Task 2: Parallel and sequential signing engine
router.post('/:id/start', authenticateToken as RequestHandler, workflowHandlers.start);
router.patch('/:id/sign', authenticateToken as RequestHandler, workflowHandlers.sign);
router.patch('/:id/decline', authenticateToken as RequestHandler, workflowHandlers.decline);
router.get('/:id/status', authenticateToken as RequestHandler, workflowHandlers.getStatus);

// Task 3: Signing notification and reminder API
router.post('/:id/remind', authenticateToken as RequestHandler, workflowHandlers.sendReminders);
router.put('/:id/reminders', authenticateToken as RequestHandler, workflowHandlers.configureReminders);

// Task 4: Workflow action history API
router.get('/:id/history', authenticateToken as RequestHandler, workflowHandlers.getHistory);

// Self-signing endpoint (authenticated user signs their own fields)
router.post('/:id/self-sign', authenticateToken as RequestHandler, ((req: AuthenticatedRequest, res: Response): void => {
  SigningController.selfSign(req, res);
}) as RequestHandler);

export default router;
