import { DataService } from './DataService';
import {
  AuditLog,
  AuditLogSearchParams,
  AuditLogSearchResponse,
  ComplianceReport,
  ComplianceAlertRule,
  ComplianceAlertRuleCreateRequest,
  ComplianceAlert,
} from '../types/audit';

/**
 * resource_type used for every privileged platform-admin action, so the admin
 * activity log can be filtered apart from ordinary user activity.
 */
export const ADMIN_ACTION_RESOURCE_TYPE = 'admin_action';

/**
 * A privileged action taken by a platform administrator against a customer
 * account. Recorded with before/after values so a change is reviewable.
 */
export interface AdminActionParams {
  /** The platform administrator performing the action. */
  adminId: string;
  /** The account the action was performed against, if any. */
  targetUserId: string | null;
  /** Dotted action name, e.g. 'admin.account.revoke' or 'admin.plan.override'. */
  action: string;
  /** State before the change. Omit for read or non-mutating actions. */
  before?: Record<string, unknown> | null;
  /** State after the change. */
  after?: Record<string, unknown> | null;
  /** Operator-supplied justification. Required by the mutating endpoints. */
  reason?: string | null;
  ipAddress: string;
  userAgent: string;
}

/**
 * AuditService handles all audit log and compliance operations.
 * Audit logs are immutable - no update or delete operations are exposed.
 */
export class AuditService {
  /**
   * Record a privileged platform-admin action.
   *
   * Writes to the same immutable audit_logs table as ordinary events, but
   * always under resource_type 'admin_action' and with the acting admin in
   * user_id, so "who changed this customer's account, when, and why" is
   * answerable from one query.
   */
  static async logAdminAction(params: AdminActionParams): Promise<AuditLog> {
    return AuditService.logEvent({
      userId: params.adminId,
      action: params.action,
      resourceType: ADMIN_ACTION_RESOURCE_TYPE,
      resourceId: params.targetUserId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: {
        targetUserId: params.targetUserId,
        before: params.before ?? null,
        after: params.after ?? null,
        reason: params.reason ?? null,
      },
    });
  }

  /**
   * Log an audit event. This is the primary write method for audit entries.
   */
  static async logEvent(params: {
    userId: string | null;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, any>;
  }): Promise<AuditLog> {
    const result = await DataService.queryOne<AuditLog>(
      `INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        params.userId,
        params.action,
        params.resourceType,
        params.resourceId || null,
        params.ipAddress,
        params.userAgent,
        JSON.stringify(params.metadata || {}),
      ]
    );
    return result!;
  }

  /**
   * Search and filter audit logs with pagination.
   */
  static async getAuditLogs(params: AuditLogSearchParams): Promise<AuditLogSearchResponse> {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(200, Math.max(1, params.limit || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (params.dateFrom) {
      conditions.push(`created_at >= $${paramIndex}`);
      values.push(params.dateFrom);
      paramIndex++;
    }
    if (params.dateTo) {
      conditions.push(`created_at <= $${paramIndex}`);
      values.push(params.dateTo);
      paramIndex++;
    }
    if (params.userId) {
      conditions.push(`user_id = $${paramIndex}`);
      values.push(params.userId);
      paramIndex++;
    }
    if (params.action) {
      conditions.push(`action ILIKE $${paramIndex}`);
      values.push(`%${params.action}%`);
      paramIndex++;
    }
    if (params.resourceType) {
      conditions.push(`resource_type = $${paramIndex}`);
      values.push(params.resourceType);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await DataService.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs ${whereClause}`,
      values
    );
    const total = parseInt(countResult?.count || '0', 10);

    // Get paginated items
    const items = await DataService.queryAll<AuditLog>(
      `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Generate a compliance report for a date range.
   */
  static async getComplianceReport(dateFrom: string, dateTo: string): Promise<ComplianceReport> {
    // Total actions
    const totalResult = await DataService.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= $1 AND created_at <= $2`,
      [dateFrom, dateTo]
    );
    const totalActions = parseInt(totalResult?.count || '0', 10);

    // Distinct users
    const usersResult = await DataService.queryOne<{ count: string }>(
      `SELECT COUNT(DISTINCT user_id) as count FROM audit_logs WHERE created_at >= $1 AND created_at <= $2 AND user_id IS NOT NULL`,
      [dateFrom, dateTo]
    );
    const distinctUsers = parseInt(usersResult?.count || '0', 10);

    // Action breakdown
    const breakdownRows = await DataService.queryAll<{ action: string; count: string }>(
      `SELECT action, COUNT(*) as count FROM audit_logs WHERE created_at >= $1 AND created_at <= $2 GROUP BY action ORDER BY count DESC`,
      [dateFrom, dateTo]
    );
    const actionBreakdown: Record<string, number> = {};
    for (const row of breakdownRows) {
      actionBreakdown[row.action] = parseInt(row.count, 10);
    }

    // Top users (top 10)
    const topUsersRows = await DataService.queryAll<{ user_id: string; action_count: string }>(
      `SELECT user_id, COUNT(*) as action_count FROM audit_logs WHERE created_at >= $1 AND created_at <= $2 AND user_id IS NOT NULL GROUP BY user_id ORDER BY action_count DESC LIMIT 10`,
      [dateFrom, dateTo]
    );
    const topUsers = topUsersRows.map((row) => ({
      user_id: row.user_id,
      action_count: parseInt(row.action_count, 10),
    }));

    // Compliance score: simple heuristic based on audit coverage
    // 100 = good coverage, deduct points for anomalies
    let complianceScore = 100;
    // Deduct if there are actions without user_id (unauthenticated)
    const unauthResult = await DataService.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM audit_logs WHERE created_at >= $1 AND created_at <= $2 AND user_id IS NULL`,
      [dateFrom, dateTo]
    );
    const unauthCount = parseInt(unauthResult?.count || '0', 10);
    if (totalActions > 0) {
      const unauthRatio = unauthCount / totalActions;
      complianceScore = Math.max(0, Math.round(100 - unauthRatio * 50));
    }

    return {
      totalActions,
      distinctUsers,
      actionBreakdown,
      topUsers,
      complianceScore,
    };
  }

  /**
   * Create a compliance alert rule.
   */
  static async createAlertRule(params: ComplianceAlertRuleCreateRequest): Promise<ComplianceAlertRule> {
    const result = await DataService.queryOne<ComplianceAlertRule>(
      `INSERT INTO compliance_alert_rules (rule_type, threshold, enabled)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [params.rule_type, params.threshold, params.enabled !== false]
    );
    return result!;
  }

  /**
   * Get all compliance alert rules.
   */
  static async getAlertRules(): Promise<ComplianceAlertRule[]> {
    return DataService.queryAll<ComplianceAlertRule>(
      `SELECT * FROM compliance_alert_rules ORDER BY created_at DESC`
    );
  }

  /**
   * Get triggered compliance alerts.
   */
  static async getTriggeredAlerts(): Promise<ComplianceAlert[]> {
    return DataService.queryAll<ComplianceAlert>(
      `SELECT * FROM compliance_alerts ORDER BY triggered_at DESC`
    );
  }

  /**
   * Export audit logs as CSV for a date range.
   */
  static async exportAuditLogs(dateFrom: string, dateTo: string): Promise<string> {
    const rows = await DataService.queryAll<AuditLog>(
      `SELECT * FROM audit_logs WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC`,
      [dateFrom, dateTo]
    );

    const headers = ['id', 'user_id', 'action', 'resource_type', 'resource_id', 'ip_address', 'user_agent', 'metadata', 'created_at'];
    const csvLines: string[] = [headers.join(',')];

    for (const row of rows) {
      const line = [
        row.id,
        row.user_id || '',
        `"${(row.action || '').replace(/"/g, '""')}"`,
        `"${(row.resource_type || '').replace(/"/g, '""')}"`,
        row.resource_id || '',
        `"${(row.ip_address || '').replace(/"/g, '""')}"`,
        `"${(row.user_agent || '').replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.metadata || {}).replace(/"/g, '""')}"`,
        row.created_at ? new Date(row.created_at).toISOString() : '',
      ].join(',');
      csvLines.push(line);
    }

    return csvLines.join('\n');
  }
}

export default AuditService;
