import { Response } from 'express';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * NotificationController handles HTTP requests for notification endpoints.
 */
export class NotificationController {
  /**
   * Get all notifications for authenticated user.
   * GET /api/notifications
   */
  static async getAll(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const notifications = await NotificationService.getByUserId(req.userId);

      res.status(200).json({
        success: true,
        data: { notifications },
      });
    } catch (error: any) {
      console.error('Notification retrieval error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Mark all notifications as read.
   * PATCH /api/notifications/read
   */
  static async markAllRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      await NotificationService.markAllRead(req.userId);

      res.status(200).json({ success: true, message: 'All notifications marked as read' });
    } catch (error: any) {
      console.error('Mark read error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default NotificationController;
