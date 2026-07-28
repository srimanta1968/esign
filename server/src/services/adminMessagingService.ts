import { DataService } from './DataService';
import { EmailService } from './emailService';
import { NotificationService } from './notificationService';

/**
 * Templated welcome and follow-up messaging sent from the admin portal.
 *
 * Delivery reuses the existing email and in-app notification infrastructure
 * rather than introducing a second sender. Every attempt is recorded —
 * including skipped and failed ones — because "we never sent it" is exactly
 * what an operator needs to see when a customer says they heard nothing.
 */

/** Notification type recorded against opt-out preferences for admin messages. */
const ADMIN_MESSAGE_PREFERENCE_TYPE = 'admin_message';

/** Per-user cap so a segment send cannot repeatedly hit the same account. */
const MIN_HOURS_BETWEEN_MESSAGES = 24;

/**
 * Deliverable channels.
 *
 * SMS is deliberately absent: `users` stores no phone number, so an SMS
 * template would have no destination. Add it when a phone column exists —
 * smsService is already available.
 */
export type MessageChannel = 'email' | 'in_app';
export type SendStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  channel: MessageChannel;
  subject: string;
  body: string;
  is_active: boolean;
}

export interface SendOutcome {
  userId: string;
  email: string;
  status: SendStatus;
  reason?: string;
}

/** Recipient fields available for substitution in a template. */
interface RecipientContext {
  id: string;
  email: string;
  name: string | null;
  plan: string | null;
  documents_limit: number | null;
}

/**
 * Whitelisted segment filters.
 *
 * Deliberately NOT free-form SQL: the admin UI picks from these keys and the
 * values are bound as parameters, so a segment can never become an injection
 * vector.
 */
export interface SegmentFilters {
  plan?: string;
  subscriptionStatus?: string;
  accessStatus?: string;
  registeredMoreThanDays?: number;
  documentsSentAtMost?: number;
  neverLoggedIn?: boolean;
}

export class AdminMessagingService {
  /**
   * Substitute {{placeholders}} in a template body.
   *
   * An unknown placeholder throws rather than rendering literally — a customer
   * receiving "Hi {{name}}" is worse than a failed send an operator can see.
   */
  static render(template: string, context: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      if (!(key in context)) {
        throw new Error(`Template references unknown variable "${key}"`);
      }
      return context[key];
    });
  }

  /** Variables a template author may reference. */
  static availableVariables(): string[] {
    return ['name', 'email', 'plan', 'documents_limit'];
  }

  static async getTemplateByKey(key: string): Promise<MessageTemplate | null> {
    return DataService.queryOne<MessageTemplate>(
      'SELECT id, key, name, channel, subject, body, is_active FROM message_templates WHERE key = $1',
      [key]
    );
  }

  static async listTemplates(): Promise<MessageTemplate[]> {
    return DataService.queryAll<MessageTemplate>(
      'SELECT id, key, name, channel, subject, body, is_active FROM message_templates ORDER BY key ASC'
    );
  }

  /**
   * Create or update a template, keyed on its stable `key`.
   */
  static async upsertTemplate(params: {
    key: string;
    name: string;
    channel: MessageChannel;
    subject: string;
    body: string;
    isActive: boolean;
    adminId: string;
  }): Promise<MessageTemplate> {
    const row = await DataService.queryOne<MessageTemplate>(
      `INSERT INTO message_templates (key, name, channel, subject, body, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO UPDATE SET
         name = EXCLUDED.name, channel = EXCLUDED.channel, subject = EXCLUDED.subject,
         body = EXCLUDED.body, is_active = EXCLUDED.is_active, updated_at = NOW()
       RETURNING id, key, name, channel, subject, body, is_active`,
      [params.key, params.name, params.channel, params.subject, params.body, params.isActive, params.adminId]
    );

    if (!row) {
      throw new Error('Failed to save template');
    }

    return row;
  }

  /**
   * Load the recipient context used for substitution.
   */
  private static async getRecipient(userId: string): Promise<RecipientContext | null> {
    return DataService.queryOne<RecipientContext>(
      `SELECT u.id, u.email, u.name,
              COALESCE(s.plan, u.plan, 'free') AS plan,
              ut.documents_limit
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN usage_tracking ut ON ut.user_id = u.id AND ut.month_year = to_char(NOW(), 'YYYY-MM')
       WHERE u.id = $1`,
      [userId]
    );
  }

  /**
   * Why this recipient should be skipped, or null when they may be messaged.
   */
  private static async skipReason(userId: string, channel: MessageChannel): Promise<string | null> {
    const preference = await DataService.queryOne<{ email_enabled: boolean; in_app_enabled: boolean; sms_enabled: boolean }>(
      `SELECT email_enabled, in_app_enabled, sms_enabled
       FROM notification_preferences
       WHERE user_id = $1 AND notification_type = $2`,
      [userId, ADMIN_MESSAGE_PREFERENCE_TYPE]
    );

    if (preference) {
      const enabled = channel === 'email' ? preference.email_enabled : preference.in_app_enabled;

      if (!enabled) {
        return `Recipient opted out of ${channel} admin messages`;
      }
    }

    const recent = await DataService.queryOne<{ id: string }>(
      `SELECT id FROM admin_message_sends
       WHERE user_id = $1 AND status = 'sent'
         AND created_at > NOW() - ($2 || ' hours')::interval
       LIMIT 1`,
      [userId, String(MIN_HOURS_BETWEEN_MESSAGES)]
    );

    if (recent) {
      return `Already messaged within the last ${MIN_HOURS_BETWEEN_MESSAGES} hours`;
    }

    return null;
  }

  /** Record a send attempt. */
  private static async logSend(params: {
    templateId: string | null;
    templateKey: string;
    userId: string;
    sentBy: string | null;
    channel: MessageChannel;
    status: SendStatus;
    skipReason?: string | null;
    error?: string | null;
  }): Promise<void> {
    // sent_at is computed here rather than with a CASE over the status
    // parameter: reusing one placeholder as both a value and a comparison
    // operand leaves Postgres unable to infer its type.
    const sentAt = params.status === 'sent' ? new Date() : null;

    await DataService.queryOne(
      `INSERT INTO admin_message_sends (
         template_id, template_key, user_id, sent_by, channel, status,
         skip_reason, error, sent_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        params.templateId,
        params.templateKey,
        params.userId,
        params.sentBy,
        params.channel,
        params.status,
        params.skipReason || null,
        params.error || null,
        sentAt,
      ]
    );
  }

  /**
   * Send one templated message to one account.
   *
   * Never throws for an ordinary delivery problem — it records the outcome and
   * returns it, so a batch can continue past a single bad recipient.
   */
  static async sendToUser(
    templateKey: string,
    userId: string,
    adminId: string | null
  ): Promise<SendOutcome> {
    const template = await AdminMessagingService.getTemplateByKey(templateKey);

    if (!template || !template.is_active) {
      throw new Error(`Template "${templateKey}" not found or inactive`);
    }

    const recipient = await AdminMessagingService.getRecipient(userId);

    if (!recipient) {
      throw new Error('Account not found');
    }

    const skip = await AdminMessagingService.skipReason(userId, template.channel);

    if (skip) {
      await AdminMessagingService.logSend({
        templateId: template.id,
        templateKey: template.key,
        userId,
        sentBy: adminId,
        channel: template.channel,
        status: 'skipped',
        skipReason: skip,
      });

      return { userId, email: recipient.email, status: 'skipped', reason: skip };
    }

    const context: Record<string, string> = {
      name: recipient.name || 'there',
      email: recipient.email,
      plan: recipient.plan || 'free',
      documents_limit: String(recipient.documents_limit ?? ''),
    };

    try {
      const body = AdminMessagingService.render(template.body, context);
      const subject = AdminMessagingService.render(template.subject || '', context);

      if (template.channel === 'email') {
        const result = await EmailService.send(recipient.email, subject, body);

        if (!result.success) {
          throw new Error(result.error || 'Email delivery failed');
        }
      } else if (template.channel === 'in_app') {
        await NotificationService.create(userId, ADMIN_MESSAGE_PREFERENCE_TYPE, body);
      } else {
        // Explicit rather than a silent fallback: delivering an in-app alert
        // when the template asked for something else would look like success.
        throw new Error(`Unsupported message channel "${template.channel}"`);
      }

      await AdminMessagingService.logSend({
        templateId: template.id,
        templateKey: template.key,
        userId,
        sentBy: adminId,
        channel: template.channel,
        status: 'sent',
      });

      return { userId, email: recipient.email, status: 'sent' };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';

      await AdminMessagingService.logSend({
        templateId: template.id,
        templateKey: template.key,
        userId,
        sentBy: adminId,
        channel: template.channel,
        status: 'failed',
        error: message,
      });

      return { userId, email: recipient.email, status: 'failed', reason: message };
    }
  }

  /**
   * Resolve a segment to its matching account ids.
   *
   * Every predicate is whitelisted and parameterised — the caller supplies
   * values, never SQL.
   */
  static async resolveSegment(filters: SegmentFilters, limit = 1000): Promise<{ id: string }[]> {
    const conditions: string[] = ["COALESCE(u.access_status, 'active') = 'active'"];
    const values: unknown[] = [];
    let index = 1;

    if (filters.plan) {
      conditions.push(`COALESCE(s.plan, u.plan, 'free') = $${index}`);
      values.push(filters.plan);
      index++;
    }
    if (filters.subscriptionStatus) {
      conditions.push(`COALESCE(s.status, 'active') = $${index}`);
      values.push(filters.subscriptionStatus);
      index++;
    }
    if (filters.accessStatus) {
      conditions[0] = `COALESCE(u.access_status, 'active') = $${index}`;
      values.push(filters.accessStatus);
      index++;
    }
    if (filters.registeredMoreThanDays !== undefined) {
      conditions.push(`u.created_at < NOW() - ($${index} || ' days')::interval`);
      values.push(String(filters.registeredMoreThanDays));
      index++;
    }
    if (filters.documentsSentAtMost !== undefined) {
      conditions.push(
        `COALESCE((SELECT COUNT(*) FROM documents d WHERE d.user_id = u.id), 0) <= $${index}`
      );
      values.push(filters.documentsSentAtMost);
      index++;
    }
    if (filters.neverLoggedIn) {
      conditions.push('NOT EXISTS (SELECT 1 FROM sessions se WHERE se.user_id = u.id)');
    }

    return DataService.queryAll<{ id: string }>(
      `SELECT u.id
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY u.created_at DESC
       LIMIT $${index}`,
      [...values, limit]
    );
  }

  /**
   * Send a template to everyone in a segment.
   *
   * One recipient failing never aborts the rest — each outcome is recorded and
   * returned so the operator sees exactly who got what.
   */
  static async sendToSegment(
    templateKey: string,
    filters: SegmentFilters,
    adminId: string
  ): Promise<{ outcomes: SendOutcome[]; sent: number; skipped: number; failed: number }> {
    const recipients = await AdminMessagingService.resolveSegment(filters);
    const outcomes: SendOutcome[] = [];

    for (const recipient of recipients) {
      try {
        outcomes.push(await AdminMessagingService.sendToUser(templateKey, recipient.id, adminId));
      } catch (error: unknown) {
        outcomes.push({
          userId: recipient.id,
          email: '',
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      outcomes,
      sent: outcomes.filter((o) => o.status === 'sent').length,
      skipped: outcomes.filter((o) => o.status === 'skipped').length,
      failed: outcomes.filter((o) => o.status === 'failed').length,
    };
  }

  /**
   * Send history for one account, newest first.
   */
  static async getSendHistory(
    userId: string,
    page = 1,
    limit = 50
  ): Promise<{ items: unknown[]; total: number; page: number; totalPages: number }> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const countRow = await DataService.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM admin_message_sends WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countRow?.count || '0', 10);

    const items = await DataService.queryAll(
      `SELECT m.id, m.template_key, m.channel, m.status, m.skip_reason, m.error,
              m.sent_at, m.created_at, sender.email AS sent_by_email
       FROM admin_message_sends m
       LEFT JOIN users sender ON sender.id = m.sent_by
       WHERE m.user_id = $1
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset]
    );

    return { items, total, page: safePage, totalPages: Math.ceil(total / safeLimit) || 1 };
  }
}

export default AdminMessagingService;
