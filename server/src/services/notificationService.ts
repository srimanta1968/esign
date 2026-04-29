import { Response } from 'express';
import { DataService } from './DataService';
import { EmailService } from './emailService';
import { SmsService } from './smsService';
import {
  Notification,
  NotificationResponse,
  DeliveryChannel,
  NotificationDeliveryLog,
  SendNotificationRequest,
  NotificationType,
  NotificationPreference,
  NotificationPreferenceResponse,
  ALL_NOTIFICATION_TYPES,
  SSEConnection,
} from '../types/notification';

/**
 * NotificationService handles in-app notification operations,
 * multi-channel delivery, SSE real-time push, and preferences.
 */
export class NotificationService {
  // SSE connection tracking
  private static connections: Map<string, SSEConnection[]> = new Map();
  private static heartbeatInterval: ReturnType<typeof setInterval> | null = null;

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
          action_url TEXT DEFAULT NULL,
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
  static async create(userId: string, type: string, message: string, actionUrl?: string): Promise<NotificationResponse> {
    try {
      await NotificationService.ensureSchema();
      const notification = await DataService.queryOne<Notification>(
        'INSERT INTO notifications (user_id, type, message, action_url) VALUES ($1, $2, $3, $4) RETURNING id, user_id, type, message, is_read, action_url, created_at',
        [userId, type, message, actionUrl || null]
      );

      if (!notification) {
        throw new Error('Failed to create notification');
      }

      const response: NotificationResponse = {
        id: notification.id,
        user_id: notification.user_id,
        type: notification.type,
        message: notification.message,
        is_read: notification.is_read,
        action_url: notification.action_url,
        created_at: notification.created_at.toISOString(),
      };

      // Push to connected SSE clients
      NotificationService.pushToUser(userId, response);

      return response;
    } catch (error: unknown) {
      throw new Error(`Notification creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the latest notifications for a user. Caps at 10 — older notifications
   * are visible only via the dedicated history page (none today) and are
   * auto-pruned by pruneOldNotifications().
   */
  static async getByUserId(userId: string): Promise<NotificationResponse[]> {
    try {
      await NotificationService.ensureSchema();
      const notifications = await DataService.queryAll<Notification>(
        'SELECT id, user_id, type, message, is_read, action_url, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
        [userId]
      );

      return notifications.map((n: Notification): NotificationResponse => ({
        id: n.id,
        user_id: n.user_id,
        type: n.type,
        message: n.message,
        is_read: n.is_read,
        action_url: n.action_url,
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

  /**
   * Prune notifications to keep the table bounded:
   *   1. Delete read notifications older than `ttlDays` (default 30).
   *   2. Per-user cap: keep only the most recent `maxPerUser` (default 50).
   * Called once on startup and daily by the scheduler in app.ts.
   */
  static async pruneOldNotifications(
    ttlDays: number = 30,
    maxPerUser: number = 50
  ): Promise<{ deletedByTtl: number; deletedByCap: number }> {
    let deletedByTtl = 0;
    let deletedByCap = 0;

    try {
      const ttlResult = await DataService.query(
        `DELETE FROM notifications
         WHERE is_read = true
           AND created_at < NOW() - ($1::int || ' days')::interval`,
        [ttlDays]
      );
      deletedByTtl = ttlResult.rowCount ?? 0;
    } catch (err) {
      console.warn('Notification TTL prune failed:', err instanceof Error ? err.message : err);
    }

    try {
      const capResult = await DataService.query(
        `DELETE FROM notifications n
          USING (
            SELECT id FROM (
              SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS rn
              FROM notifications
            ) ranked WHERE ranked.rn > $1
          ) excess
          WHERE n.id = excess.id`,
        [maxPerUser]
      );
      deletedByCap = capResult.rowCount ?? 0;
    } catch (err) {
      console.warn('Notification per-user cap prune failed:', err instanceof Error ? err.message : err);
    }

    return { deletedByTtl, deletedByCap };
  }

  // ============================================================
  // Multi-channel delivery (Task 1)
  // ============================================================

  /**
   * Send a notification via specified channels with delivery logging.
   */
  static async sendMultiChannel(request: SendNotificationRequest): Promise<{
    notification: NotificationResponse;
    deliveries: { channel: DeliveryChannel; status: string; error?: string }[];
  }> {
    // Get user preferences to check which channels are enabled
    const preferences = await NotificationService.getPreferences(request.userId);
    const prefForType = preferences.find(p => p.notification_type === request.type);

    // Create the in-app notification
    const notification = await NotificationService.create(
      request.userId,
      request.type,
      request.message,
      request.actionUrl
    );

    // Get user email for email/sms delivery
    const user = await DataService.queryOne<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [request.userId]
    );

    const deliveries: { channel: DeliveryChannel; status: string; error?: string }[] = [];

    for (const channel of request.channels) {
      // Check if channel is enabled in preferences (default to enabled)
      const channelEnabled = !prefForType || (
        (channel === 'email' && prefForType.email_enabled) ||
        (channel === 'sms' && prefForType.sms_enabled) ||
        (channel === 'in_app' && prefForType.in_app_enabled)
      );

      if (!channelEnabled) {
        deliveries.push({ channel, status: 'skipped', error: 'Disabled in preferences' });
        continue;
      }

      let status: 'sent' | 'failed' = 'failed';
      let errorMessage: string | null = null;

      try {
        if (channel === 'email' && user?.email) {
          const result = await EmailService.sendNotification(
            user.email,
            request.type,
            request.message,
            request.actionUrl
          );
          status = result.success ? 'sent' : 'failed';
          errorMessage = result.error || null;
        } else if (channel === 'sms') {
          // In dev, we use a placeholder phone number
          const result = await SmsService.sendNotification(
            'dev-phone',
            request.message,
            request.actionUrl
          );
          status = result.success ? 'sent' : 'failed';
          errorMessage = result.error || null;
        } else if (channel === 'in_app') {
          // Already created as in-app notification above
          status = 'sent';
        }
      } catch (err: unknown) {
        status = 'failed';
        errorMessage = err instanceof Error ? err.message : 'Unknown delivery error';
      }

      // Log delivery
      await NotificationService.logDelivery(
        notification.id,
        channel,
        channel === 'email' ? (user?.email || 'unknown') : channel === 'sms' ? 'dev-phone' : request.userId,
        status,
        errorMessage
      );

      deliveries.push({ channel, status, error: errorMessage || undefined });
    }

    return { notification, deliveries };
  }

  /**
   * Log a delivery attempt to notification_delivery_log.
   */
  static async logDelivery(
    notificationId: string,
    channel: DeliveryChannel,
    recipient: string,
    status: 'pending' | 'sent' | 'failed',
    errorMessage?: string | null
  ): Promise<void> {
    try {
      await DataService.query(
        `INSERT INTO notification_delivery_log (notification_id, channel, recipient, status, sent_at, error_message)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          notificationId,
          channel,
          recipient,
          status,
          status === 'sent' ? new Date() : null,
          errorMessage || null,
        ]
      );
    } catch (error: unknown) {
      console.error('Failed to log delivery:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // ============================================================
  // SSE Real-time push (Task 2)
  // ============================================================

  /**
   * Register an SSE connection for a user.
   */
  static addSSEConnection(userId: string, res: Response): void {
    const connection: SSEConnection = {
      userId,
      response: res,
      connectedAt: new Date(),
    };

    const existing = NotificationService.connections.get(userId) || [];
    existing.push(connection);
    NotificationService.connections.set(userId, existing);

    // Start heartbeat if not already running
    if (!NotificationService.heartbeatInterval) {
      NotificationService.startHeartbeat();
    }

    console.log(`SSE: User ${userId} connected. Total connections: ${NotificationService.getConnectionCount()}`);
  }

  /**
   * Remove an SSE connection for a user.
   */
  static removeSSEConnection(userId: string, res: Response): void {
    const existing = NotificationService.connections.get(userId) || [];
    const filtered = existing.filter(c => c.response !== res);

    if (filtered.length === 0) {
      NotificationService.connections.delete(userId);
    } else {
      NotificationService.connections.set(userId, filtered);
    }

    console.log(`SSE: User ${userId} disconnected. Total connections: ${NotificationService.getConnectionCount()}`);

    // Stop heartbeat if no connections remain
    if (NotificationService.getConnectionCount() === 0 && NotificationService.heartbeatInterval) {
      clearInterval(NotificationService.heartbeatInterval);
      NotificationService.heartbeatInterval = null;
    }
  }

  /**
   * Push a notification to a specific user via SSE.
   */
  static pushToUser(userId: string, notification: NotificationResponse): void {
    const connections = NotificationService.connections.get(userId);
    if (!connections || connections.length === 0) return;

    const data = JSON.stringify(notification);
    const deadConnections: Response[] = [];

    for (const conn of connections) {
      try {
        conn.response.write(`event: notification\ndata: ${data}\n\n`);
      } catch {
        deadConnections.push(conn.response);
      }
    }

    // Clean up dead connections
    for (const dead of deadConnections) {
      NotificationService.removeSSEConnection(userId, dead);
    }
  }

  /**
   * Get total number of active SSE connections.
   */
  static getConnectionCount(): number {
    let count = 0;
    for (const connections of NotificationService.connections.values()) {
      count += connections.length;
    }
    return count;
  }

  /**
   * Get list of connected user IDs.
   */
  static getConnectedUsers(): string[] {
    return Array.from(NotificationService.connections.keys());
  }

  /**
   * Start heartbeat to keep SSE connections alive (every 30 seconds).
   */
  private static startHeartbeat(): void {
    NotificationService.heartbeatInterval = setInterval(() => {
      const deadConnections: { userId: string; res: Response }[] = [];

      for (const [userId, connections] of NotificationService.connections.entries()) {
        for (const conn of connections) {
          try {
            conn.response.write(`:heartbeat\n\n`);
          } catch {
            deadConnections.push({ userId, res: conn.response });
          }
        }
      }

      // Clean up dead connections
      for (const dead of deadConnections) {
        NotificationService.removeSSEConnection(dead.userId, dead.res);
      }
    }, 30000);
  }

  // ============================================================
  // Notification Preferences (Task 3)
  // ============================================================

  /**
   * Get notification preferences for a user. Creates defaults if none exist.
   */
  static async getPreferences(userId: string): Promise<NotificationPreferenceResponse[]> {
    try {
      const existing = await DataService.queryAll<NotificationPreference>(
        'SELECT notification_type, email_enabled, sms_enabled, in_app_enabled FROM notification_preferences WHERE user_id = $1 ORDER BY notification_type',
        [userId]
      );

      if (existing.length === 0) {
        // Create default preferences (all enabled)
        await NotificationService.createDefaultPreferences(userId);
        return ALL_NOTIFICATION_TYPES.map(t => ({
          notification_type: t,
          email_enabled: true,
          sms_enabled: true,
          in_app_enabled: true,
        }));
      }

      return existing.map(p => ({
        notification_type: p.notification_type as NotificationType,
        email_enabled: p.email_enabled,
        sms_enabled: p.sms_enabled,
        in_app_enabled: p.in_app_enabled,
      }));
    } catch (error: unknown) {
      throw new Error(`Failed to get preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update notification preferences for a user (bulk update).
   */
  static async updatePreferences(
    userId: string,
    preferences: NotificationPreferenceResponse[]
  ): Promise<NotificationPreferenceResponse[]> {
    try {
      for (const pref of preferences) {
        await DataService.query(
          `INSERT INTO notification_preferences (user_id, notification_type, email_enabled, sms_enabled, in_app_enabled, updated_at)
           VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
           ON CONFLICT (user_id, notification_type)
           DO UPDATE SET email_enabled = $3, sms_enabled = $4, in_app_enabled = $5, updated_at = CURRENT_TIMESTAMP`,
          [userId, pref.notification_type, pref.email_enabled, pref.sms_enabled, pref.in_app_enabled]
        );
      }

      return NotificationService.getPreferences(userId);
    } catch (error: unknown) {
      throw new Error(`Failed to update preferences: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create default preferences for a user (all channels enabled for all types).
   */
  private static async createDefaultPreferences(userId: string): Promise<void> {
    for (const type of ALL_NOTIFICATION_TYPES) {
      await DataService.query(
        `INSERT INTO notification_preferences (user_id, notification_type, email_enabled, sms_enabled, in_app_enabled)
         VALUES ($1, $2, true, true, true)
         ON CONFLICT (user_id, notification_type) DO NOTHING`,
        [userId, type]
      );
    }
  }

  // ============================================================
  // Document status change hooks
  // ============================================================

  /**
   * Trigger notification when a document signature is requested.
   */
  static async onSignatureRequested(userId: string, documentId: string, documentName: string): Promise<void> {
    try {
      await NotificationService.sendMultiChannel({
        userId,
        type: 'signature_requested',
        message: `You have been requested to sign "${documentName}"`,
        channels: ['email', 'sms', 'in_app'],
        actionUrl: `/documents/${documentId}`,
      });
    } catch (error: unknown) {
      console.error('Failed to send signature_requested notification:', error);
    }
  }

  /**
   * Trigger notification when a document signature is completed.
   */
  static async onSignatureCompleted(ownerId: string, signerName: string, documentId: string, documentName: string): Promise<void> {
    try {
      await NotificationService.sendMultiChannel({
        userId: ownerId,
        type: 'signature_completed',
        message: `${signerName} has signed "${documentName}"`,
        channels: ['email', 'in_app'],
        actionUrl: `/documents/${documentId}`,
      });
    } catch (error: unknown) {
      console.error('Failed to send signature_completed notification:', error);
    }
  }
}

export default NotificationService;
