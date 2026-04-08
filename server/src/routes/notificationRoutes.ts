import { Router, Response, RequestHandler } from 'express';
import { NotificationController } from '../controllers/notificationController';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
// @governance-tracked — API definitions added: GET /api/notifications, PATCH /api/notifications/read

interface NotificationRouter {
  getAll: RequestHandler;
  markAllRead: RequestHandler;
}

const notificationHandlers: NotificationRouter = {
  getAll: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.getAll(req, res);
  },
  markAllRead: (req: AuthenticatedRequest, res: Response): void => {
    NotificationController.markAllRead(req, res);
  },
};

const router: Router = Router();

router.get('/', authenticateToken as RequestHandler, notificationHandlers.getAll);
router.patch('/read', authenticateToken as RequestHandler, notificationHandlers.markAllRead);

export default router;
