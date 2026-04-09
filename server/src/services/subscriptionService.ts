import { DataService } from './DataService';
import { PLAN_LIMITS } from './stripeService';

function currentMonthYear(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
}

interface SubscriptionRow {
  plan: string;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  seats: number;
}

interface UsageRow {
  documents_sent: number;
  documents_limit: number;
}

interface TeamInfo {
  team_id: string;
  team_plan: string;
  team_document_limit: number;
  owner_id: string;
}

export class SubscriptionService {
  /**
   * Get the current plan, status, and usage for a user.
   */
  static async getPlan(userId: string) {
    const sub = await DataService.queryOne<SubscriptionRow>(
      'SELECT plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, seats FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    const plan = sub?.plan || 'free';
    const status = sub?.status || 'active';
    const usage = await SubscriptionService.getUsage(userId);

    return {
      plan,
      status,
      usage: {
        sent: usage.documents_sent,
        limit: PLAN_LIMITS[plan] ?? PLAN_LIMITS.free,
      },
      stripe_customer_id: sub?.stripe_customer_id || null,
      stripe_subscription_id: sub?.stripe_subscription_id || null,
      current_period_start: sub?.current_period_start || null,
      current_period_end: sub?.current_period_end || null,
      seats: sub?.seats || 1,
    };
  }

  /**
   * Create or update a subscription record for a user.
   */
  static async createOrUpdateSubscription(
    userId: string,
    plan: string,
    stripeCustomerId: string | null,
    stripeSubscriptionId: string | null,
    periodStart: Date | null,
    periodEnd: Date | null
  ): Promise<void> {
    await DataService.query(
      `INSERT INTO subscriptions (user_id, plan, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET plan = $2, stripe_customer_id = COALESCE($3, subscriptions.stripe_customer_id),
         stripe_subscription_id = COALESCE($4, subscriptions.stripe_subscription_id),
         current_period_start = COALESCE($5, subscriptions.current_period_start),
         current_period_end = COALESCE($6, subscriptions.current_period_end),
         status = 'active', updated_at = NOW()`,
      [userId, plan, stripeCustomerId, stripeSubscriptionId, periodStart, periodEnd]
    );

    // Also update the users table plan column
    await DataService.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, userId]);

    // Update the usage limit for the current month
    const monthYear = currentMonthYear();
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    await DataService.query(
      `INSERT INTO usage_tracking (user_id, month_year, documents_limit)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, month_year)
       DO UPDATE SET documents_limit = $3, updated_at = NOW()`,
      [userId, monthYear, limit]
    );
  }

  /**
   * Cancel a subscription, reverting user to free plan.
   */
  static async cancelSubscription(userId: string): Promise<void> {
    await DataService.query(
      `UPDATE subscriptions SET plan = 'free', status = 'cancelled', updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    await DataService.query(`UPDATE users SET plan = 'free' WHERE id = $1`, [userId]);
  }

  /**
   * Try to resolve a user's team info if they belong to one.
   */
  private static async getTeamInfo(userId: string): Promise<TeamInfo | null> {
    const row = await DataService.queryOne<{
      team_id: string;
      plan: string;
      document_limit: number;
      owner_id: string;
    }>(
      `SELECT t.id AS team_id, t.plan, t.document_limit, t.owner_id
       FROM users u
       JOIN teams t ON t.id = u.team_id
       WHERE u.id = $1 AND u.team_id IS NOT NULL`,
      [userId]
    );

    if (!row) return null;

    return {
      team_id: row.team_id,
      team_plan: row.plan,
      team_document_limit: row.document_limit,
      owner_id: row.owner_id,
    };
  }

  /**
   * Get current month usage for a user. If the user belongs to a team,
   * returns team-level usage instead of individual usage.
   */
  static async getUsage(userId: string): Promise<{ documents_sent: number; documents_limit: number }> {
    const monthYear = currentMonthYear();

    // Check if user belongs to a team
    const teamInfo = await SubscriptionService.getTeamInfo(userId);

    if (teamInfo) {
      // Use team-level usage tracking keyed by team-{teamId}
      const teamUsageKey = `team-${teamInfo.team_id}`;
      const row = await DataService.queryOne<UsageRow>(
        'SELECT documents_sent, documents_limit FROM usage_tracking WHERE user_id = $1 AND month_year = $2',
        [teamInfo.owner_id, teamUsageKey]
      );
      return {
        documents_sent: row?.documents_sent ?? 0,
        documents_limit: teamInfo.team_document_limit,
      };
    }

    // Individual user usage
    const row = await DataService.queryOne<UsageRow>(
      'SELECT documents_sent, documents_limit FROM usage_tracking WHERE user_id = $1 AND month_year = $2',
      [userId, monthYear]
    );
    return {
      documents_sent: row?.documents_sent ?? 0,
      documents_limit: row?.documents_limit ?? PLAN_LIMITS.free,
    };
  }

  /**
   * Increment the documents_sent counter for the current month.
   * If the user belongs to a team, increments the shared team counter.
   */
  static async incrementUsage(userId: string): Promise<void> {
    const monthYear = currentMonthYear();

    // Check if user belongs to a team
    const teamInfo = await SubscriptionService.getTeamInfo(userId);

    if (teamInfo) {
      // Increment team-level usage using team owner's user_id and team-{teamId} as month_year key
      const teamUsageKey = `team-${teamInfo.team_id}`;
      await DataService.query(
        `INSERT INTO usage_tracking (user_id, month_year, documents_sent, documents_limit)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (user_id, month_year)
         DO UPDATE SET documents_sent = usage_tracking.documents_sent + 1, updated_at = NOW()`,
        [teamInfo.owner_id, teamUsageKey, teamInfo.team_document_limit]
      );
      return;
    }

    // Individual usage
    const sub = await DataService.queryOne<{ plan: string }>(
      'SELECT plan FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    const plan = sub?.plan || 'free';
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    await DataService.query(
      `INSERT INTO usage_tracking (user_id, month_year, documents_sent, documents_limit)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (user_id, month_year)
       DO UPDATE SET documents_sent = usage_tracking.documents_sent + 1, updated_at = NOW()`,
      [userId, monthYear, limit]
    );
  }

  /**
   * Check whether the user is within their plan limit.
   * For team members, checks against the shared team quota.
   */
  static async checkLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number; plan: string }> {
    // Check if user belongs to a team
    const teamInfo = await SubscriptionService.getTeamInfo(userId);

    if (teamInfo) {
      const usage = await SubscriptionService.getUsage(userId);
      return {
        allowed: usage.documents_sent < teamInfo.team_document_limit,
        used: usage.documents_sent,
        limit: teamInfo.team_document_limit,
        plan: teamInfo.team_plan,
      };
    }

    // Individual plan check
    const sub = await DataService.queryOne<{ plan: string }>(
      'SELECT plan FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    const plan = sub?.plan || 'free';
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const usage = await SubscriptionService.getUsage(userId);

    return {
      allowed: usage.documents_sent < limit,
      used: usage.documents_sent,
      limit,
      plan,
    };
  }
}
