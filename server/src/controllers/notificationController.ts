import { Response, RequestHandler } from 'express';
import { NotificationService } from '../services/notificationService';
import { AuthenticatedRequest } from '../middleware/auth';
import { SendNotificationRequest, DeliveryChannel, NotificationType, ALL_NOTIFICATION_TYPES } from '../types/notification';

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

  /**
   * Send a notification via specified channels.
   * POST /api/notifications/send
   */
  static async send(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { userId, type, message, channels, actionUrl } = req.body;

      // Validate required fields
      if (!userId || !type || !message || !channels || !Array.isArray(channels)) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, type, message, channels (array)',
        });
        return;
      }

      // Validate channels
      const validChannels: DeliveryChannel[] = ['email', 'sms', 'in_app'];
      for (const ch of channels) {
        if (!validChannels.includes(ch)) {
          res.status(400).json({
            success: false,
            error: `Invalid channel: ${ch}. Valid channels: ${validChannels.join(', ')}`,
          });
          return;
        }
      }

      // Validate notification type
      if (!ALL_NOTIFICATION_TYPES.includes(type as NotificationType)) {
        res.status(400).json({
          success: false,
          error: `Invalid type: ${type}. Valid types: ${ALL_NOTIFICATION_TYPES.join(', ')}`,
        });
        return;
      }

      const result = await NotificationService.sendMultiChannel({
        userId,
        type: type as NotificationType,
        message,
        channels,
        actionUrl,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      console.error('Send notification error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * SSE endpoint for real-time notifications.
   * GET /api/notifications/stream
   */
  static async stream(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const userId = req.userId;

      // Set SSE headers
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      // Send initial connection event
      res.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: new Date().toISOString() })}\n\n`);

      // Register SSE connection
      NotificationService.addSSEConnection(userId, res);

      // Handle client disconnect
      req.on('close', () => {
        NotificationService.removeSSEConnection(userId, res);
      });
    } catch (error: any) {
      console.error('SSE stream error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get notification preferences for authenticated user.
   * GET /api/notifications/preferences
   */
  static async getPreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const preferences = await NotificationService.getPreferences(req.userId);

      res.status(200).json({
        success: true,
        data: { preferences },
      });
    } catch (error: any) {
      console.error('Get preferences error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Update notification preferences for authenticated user.
   * PUT /api/notifications/preferences
   */
  static async updatePreferences(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ success: false, error: 'User not authenticated' });
        return;
      }

      const { preferences } = req.body;

      if (!preferences || !Array.isArray(preferences)) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: preferences (array)',
        });
        return;
      }

      // Validate each preference entry
      for (const pref of preferences) {
        if (!pref.notification_type || !ALL_NOTIFICATION_TYPES.includes(pref.notification_type)) {
          res.status(400).json({
            success: false,
            error: `Invalid notification_type: ${pref.notification_type}. Valid types: ${ALL_NOTIFICATION_TYPES.join(', ')}`,
          });
          return;
        }
        if (typeof pref.email_enabled !== 'boolean' ||
            typeof pref.sms_enabled !== 'boolean' ||
            typeof pref.in_app_enabled !== 'boolean') {
          res.status(400).json({
            success: false,
            error: 'email_enabled, sms_enabled, and in_app_enabled must be booleans',
          });
          return;
        }
      }

      const updated = await NotificationService.updatePreferences(req.userId, preferences);

      res.status(200).json({
        success: true,
        message: 'Notification preferences updated successfully',
        data: { preferences: updated },
      });
    } catch (error: any) {
      console.error('Update preferences error:', error);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default NotificationController;
