import { DataService } from './DataService';
import { PLAN_LIMITS } from './stripeService';
import { AccessStatus, UserRole } from '../types/user';

/**
 * Cross-account administration queries for the platform admin portal.
 *
 * Separate from userService, which is tenant-scoped CRUD for the customer
 * app. This service deliberately reads ACROSS all accounts and joins in
 * billing, usage and team state — a shape the tenant-facing service must
 * never expose.
 */

/** Hard ceiling on page size so a caller cannot request the whole table. */
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

/** Months of usage history returned with an account detail view. */
const USAGE_HISTORY_MONTHS = 6;

export interface AccountListFilters {
  search?: string;
  plan?: string;
  status?: string;
  accessStatus?: string;
  page?: number;
  limit?: number;
}

export interface AccountListRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  access_status: AccessStatus;
  plan: string;
  subscription_status: string;
  documents_sent: number;
  documents_limit: number;
  team_id: string | null;
  team_name: string | null;
  document_count: number;
  created_at: Date;
  last_login: Date | null;
}

export interface AccountListResult {
  items: AccountListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AccountDetail {
  account: AccountListRow & {
    access_reason: string | null;
    access_changed_at: Date | null;
    access_changed_by_email: string | null;
    organization_id: string | null;
    email_verified: boolean;
    trial_ends_at: Date | null;
    credit_balance: number;
  };
  usageHistory: { month_year: string; documents_sent: number; documents_limit: number }[];
  workflowCount: number;
}

/**
 * Current month key in the YYYY-MM form used by usage_tracking.
 */
function currentMonthYear(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

export class AdminAccountService {
  /**
   * List accounts with search, filtering and pagination.
   *
   * LEFT JOINs throughout so an account with no subscription, no usage row and
   * no team still appears — those are the majority (free plan) and dropping
   * them would silently hide most of the platform.
   */
  static async listAccounts(filters: AccountListFilters): Promise<AccountListResult> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, filters.limit || DEFAULT_PAGE_SIZE));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const values: unknown[] = [currentMonthYear()];
    let paramIndex = 2;

    if (filters.search) {
      conditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }
    if (filters.plan) {
      conditions.push(`COALESCE(s.plan, u.plan, 'free') = $${paramIndex}`);
      values.push(filters.plan);
      paramIndex++;
    }
    if (filters.status) {
      conditions.push(`COALESCE(s.status, 'active') = $${paramIndex}`);
      values.push(filters.status);
      paramIndex++;
    }
    if (filters.accessStatus) {
      conditions.push(`COALESCE(u.access_status, 'active') = $${paramIndex}`);
      values.push(filters.accessStatus);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = await DataService.queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       ${whereClause}`,
      values.slice(1)
    );
    const total = parseInt(countRow?.count || '0', 10);

    const items = await DataService.queryAll<AccountListRow>(
      `SELECT
         u.id,
         COALESCE(u.name, '') AS name,
         u.email,
         COALESCE(u.role, 'user') AS role,
         COALESCE(u.access_status, 'active') AS access_status,
         COALESCE(s.plan, u.plan, 'free') AS plan,
         COALESCE(s.status, 'active') AS subscription_status,
         COALESCE(ut.documents_sent, 0) AS documents_sent,
         COALESCE(ut.documents_limit, 0) AS documents_limit,
         u.team_id,
         t.name AS team_name,
         COALESCE(dc.document_count, 0)::int AS document_count,
         u.created_at,
         sess.last_login
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN usage_tracking ut ON ut.user_id = u.id AND ut.month_year = $1
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS document_count FROM documents GROUP BY user_id
       ) dc ON dc.user_id = u.id
       LEFT JOIN (
         SELECT user_id, MAX(created_at) AS last_login FROM sessions GROUP BY user_id
       ) sess ON sess.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...values, limit, offset]
    );

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Full detail for a single account, or null when the id is unknown.
   *
   * Assembled from a bounded set of queries rather than one per section, and
   * password_hash is never selected.
   */
  static async getAccountDetail(userId: string): Promise<AccountDetail | null> {
    const account = await DataService.queryOne<AccountDetail['account']>(
      `SELECT
         u.id,
         COALESCE(u.name, '') AS name,
         u.email,
         COALESCE(u.role, 'user') AS role,
         COALESCE(u.access_status, 'active') AS access_status,
         u.access_reason,
         u.access_changed_at,
         changer.email AS access_changed_by_email,
         u.organization_id,
         COALESCE(u.email_verified, false) AS email_verified,
         COALESCE(s.plan, u.plan, 'free') AS plan,
         COALESCE(s.status, 'active') AS subscription_status,
         s.trial_ends_at,
         COALESCE(u.credit_balance, 0) AS credit_balance,
         COALESCE(ut.documents_sent, 0) AS documents_sent,
         COALESCE(ut.documents_limit, 0) AS documents_limit,
         u.team_id,
         t.name AS team_name,
         COALESCE(dc.document_count, 0)::int AS document_count,
         u.created_at,
         sess.last_login
       FROM users u
       LEFT JOIN users changer ON changer.id = u.access_changed_by
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN usage_tracking ut ON ut.user_id = u.id AND ut.month_year = $2
       LEFT JOIN teams t ON t.id = u.team_id
       LEFT JOIN (
         SELECT user_id, COUNT(*)::int AS document_count FROM documents GROUP BY user_id
       ) dc ON dc.user_id = u.id
       LEFT JOIN (
         SELECT user_id, MAX(created_at) AS last_login FROM sessions GROUP BY user_id
       ) sess ON sess.user_id = u.id
       WHERE u.id = $1`,
      [userId, currentMonthYear()]
    );

    if (!account) {
      return null;
    }

    const usageHistory = await DataService.queryAll<{
      month_year: string;
      documents_sent: number;
      documents_limit: number;
    }>(
      `SELECT month_year, documents_sent, documents_limit
       FROM usage_tracking
       WHERE user_id = $1
       ORDER BY month_year DESC
       LIMIT $2`,
      [userId, USAGE_HISTORY_MONTHS]
    );

    const workflowRow = await DataService.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM signing_workflows WHERE creator_id = $1',
      [userId]
    );

    return {
      account,
      usageHistory,
      workflowCount: parseInt(workflowRow?.count || '0', 10),
    };
  }

  /**
   * Change an account's access state.
   *
   * Suspending or revoking also expires the target's live sessions, so the
   * block takes effect on their next request instead of when their token
   * happens to expire.
   */
  static async setAccessStatus(
    targetUserId: string,
    status: AccessStatus,
    reason: string,
    adminId: string
  ): Promise<{ before: AccessStatus; after: AccessStatus; sessionsEnded: number }> {
    const current = await DataService.queryOne<{ access_status: AccessStatus | null }>(
      'SELECT access_status FROM users WHERE id = $1',
      [targetUserId]
    );

    if (!current) {
      throw new Error('Account not found');
    }

    const before: AccessStatus = current.access_status || 'active';

    await DataService.queryOne(
      `UPDATE users
       SET access_status = $1, access_reason = $2, access_changed_by = $3,
           access_changed_at = NOW(), updated_at = NOW()
       WHERE id = $4
       RETURNING id`,
      [status, reason, adminId, targetUserId]
    );

    let sessionsEnded = 0;

    if (status !== 'active') {
      const expired = await DataService.queryAll<{ id: string }>(
        'UPDATE sessions SET expires_at = NOW() WHERE user_id = $1 AND expires_at > NOW() RETURNING id',
        [targetUserId]
      );
      sessionsEnded = expired.length;
    }

    return { before, after: status, sessionsEnded };
  }

  /**
   * Aggregate counts for the portal dashboard.
   *
   * Every figure is computed in SQL rather than by fetching rows and counting
   * in JS, so this stays cheap as the account count grows.
   *
   * Payment-failure and trial-expiry tiles are added by the billing and credit
   * tasks — those columns do not exist yet, and querying them here would break
   * the dashboard until those migrations land.
   */
  static async getOverviewMetrics(): Promise<{
    totalAccounts: number;
    byAccessStatus: Record<string, number>;
    byPlan: Record<string, number>;
    bySubscriptionStatus: Record<string, number>;
    newAccountsThisMonth: number;
    documentsSentThisMonth: number;
  }> {
    const [accessRows, planRows, statusRows, newRow, usageRow] = await Promise.all([
      DataService.queryAll<{ key: string; count: string }>(
        `SELECT COALESCE(access_status, 'active') AS key, COUNT(*) AS count
         FROM users GROUP BY COALESCE(access_status, 'active')`
      ),
      DataService.queryAll<{ key: string; count: string }>(
        `SELECT COALESCE(s.plan, u.plan, 'free') AS key, COUNT(*) AS count
         FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
         GROUP BY COALESCE(s.plan, u.plan, 'free')`
      ),
      DataService.queryAll<{ key: string; count: string }>(
        `SELECT COALESCE(s.status, 'active') AS key, COUNT(*) AS count
         FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
         GROUP BY COALESCE(s.status, 'active')`
      ),
      DataService.queryOne<{ count: string }>(
        `SELECT COUNT(*) AS count FROM users
         WHERE created_at >= date_trunc('month', NOW())`
      ),
      DataService.queryOne<{ total: string }>(
        'SELECT COALESCE(SUM(documents_sent), 0) AS total FROM usage_tracking WHERE month_year = $1',
        [currentMonthYear()]
      ),
    ]);

    const toMap = (rows: { key: string; count: string }[]): Record<string, number> => {
      const map: Record<string, number> = {};
      for (const row of rows) {
        map[row.key] = parseInt(row.count, 10);
      }
      return map;
    };

    const byAccessStatus = toMap(accessRows);
    const totalAccounts = Object.values(byAccessStatus).reduce((sum, n) => sum + n, 0);

    return {
      totalAccounts,
      byAccessStatus,
      byPlan: toMap(planRows),
      bySubscriptionStatus: toMap(statusRows),
      newAccountsThisMonth: parseInt(newRow?.count || '0', 10),
      documentsSentThisMonth: parseInt(usageRow?.total || '0', 10),
    };
  }

  /**
   * Plan document limits, exposed so the portal can show a plan's ceiling
   * without duplicating the billing constants.
   */
  static planLimits(): Record<string, number> {
    return PLAN_LIMITS;
  }
}

export default AdminAccountService;
