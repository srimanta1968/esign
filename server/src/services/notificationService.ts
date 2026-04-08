import { DataService } from './DataService';
import { Notification, NotificationResponse } from '../types/notification';

/**
 * NotificationService handles in-app notification operations.
 */
export class NotificationService {
  /**
   * Ensure the notifications table exists.
   */
  static async ensureSchema(): Promise<void> {
    try {
      await DataService.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL,
          type VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `);
    } catch {
      // Table might already exist
    }
  }

  /**
   * Create a notification for a user.
   */
  static async create(userId: string, type: string, message: string): Promise<NotificationResponse> {
    try {
      await NotificationService.ensureSchema();
      const notification = await DataService.queryOne<Notification>(
        'INSERT INTO notifications (user_id, type, message) VALUES ($1, $2, $3) RETURNING id, user_id, type, message, is_read, created_at',
        [userId, type, message]
      );

      if (!notification) {
        throw new Error('Failed to create notification');
      }

      return {
        id: notification.id,
        user_id: notification.user_id,
        type: notification.type,
        message: notification.message,
        is_read: notification.is_read,
        created_at: notification.created_at.toISOString(),
      };
    } catch (error: unknown) {
      throw new Error(`Notification creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all notifications for a user.
   */
  static async getByUserId(userId: string): Promise<NotificationResponse[]> {
    try {
      await NotificationService.ensureSchema();
      const notifications = await DataService.queryAll<Notification>(
        'SELECT id, user_id, type, message, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
        [userId]
      );

      return notifications.map((n: Notification): NotificationResponse => ({
        id: n.id,
        user_id: n.user_id,
        type: n.type,
        message: n.message,
        is_read: n.is_read,
        created_at: n.created_at.toISOString(),
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to retrieve notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mark all notifications as read for a user.
   */
  static async markAllRead(userId: string): Promise<void> {
    try {
      await DataService.query(
        'UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false',
        [userId]
      );
    } catch (error: unknown) {
      throw new Error(`Failed to mark notifications: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default NotificationService;
