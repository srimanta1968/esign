import { Router, Response, RequestHandler } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: GET /api/notifications, PATCH /api/notifications/read, POST /api/notifications/send, GET /api/notifications/stream, GET /api/notifications/preferences, PUT /api/notifications/preferences

interface NotificationRouter {
  getAll: RequestHandler;
  markAllRead: RequestHandler;
  send: RequestHandler;
  stream: RequestHandler;
  getPreferences: RequestHandler;
  updatePreferences: RequestHandler;
}

const notificationHandlers: NotificationRouter = {
  getAll: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.getAll(req, res);
  },
  markAllRead: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.markAllRead(req, res);
  },
  send: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.send(req, res);
  },
  stream: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.stream(req, res);
  },
  getPreferences: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.getPreferences(req, res);
  },
  updatePreferences: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.updatePreferences(req, res);
  },
};

const router: Router = Router();

// Existing routes
router.get('/', authenticateToken as RequestHandler, notificationHandlers.getAll);
router.patch('/read', authenticateToken as RequestHandler, notificationHandlers.markAllRead);

// Task 1: Multi-channel delivery
router.post('/send', authenticateToken as RequestHandler, notificationHandlers.send);

// Task 2: SSE real-time stream
router.get('/stream', authenticateToken as RequestHandler, notificationHandlers.stream);

// Task 3: Notification preferences
router.get('/preferences', authenticateToken as RequestHandler, notificationHandlers.getPreferences);
router.put('/preferences', authenticateToken as RequestHandler, notificationHandlers.updatePreferences);

export default router;
