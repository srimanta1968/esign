import { DataService } from './DataService';

/**
 * Bonus document credits granted by platform admins.
 *
 * Credits sit ON TOP of the plan quota: the monthly plan allowance is always
 * consumed first, and credits only come into play once it is exhausted. That
 * keeps a grant from silently masking a plan that is too small.
 *
 * TEAM SCOPING — credits follow the quota. SubscriptionService tracks team
 * usage against the TEAM OWNER's row, so for a team member the quota holder,
 * and therefore the credit holder, is the owner. A grant to one member would
 * otherwise be invisible to the shared quota it is meant to extend.
 */

export type CreditSource = 'admin_grant' | 'admin_revoke' | 'consumption' | 'expiry';

export interface CreditLedgerRow {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  source: CreditSource;
  expires_at: Date | null;
  granted_by_email: string | null;
  created_at: Date;
}

export class CreditService {
  /**
   * Resolve whose credit balance applies to this user.
   *
   * Mirrors SubscriptionService's quota resolution: a team member's allowance
   * lives on the team owner.
   */
  static async resolveCreditHolder(userId: string): Promise<string> {
    const row = await DataService.queryOne<{ owner_id: string }>(
      `SELECT t.owner_id
       FROM users u
       JOIN teams t ON t.id = u.team_id
       WHERE u.id = $1 AND u.team_id IS NOT NULL`,
      [userId]
    );

    return row?.owner_id || userId;
  }

  /**
   * Current credit balance for whoever holds this user's allowance.
   */
  static async getBalance(userId: string): Promise<number> {
    const holderId = await CreditService.resolveCreditHolder(userId);

    const row = await DataService.queryOne<{ credit_balance: number }>(
      'SELECT COALESCE(credit_balance, 0) AS credit_balance FROM users WHERE id = $1',
      [holderId]
    );

    return row?.credit_balance ?? 0;
  }

  /**
   * Apply a balance change and record it in the ledger, atomically.
   *
   * The UPDATE and the ledger INSERT run as one statement via a CTE, so a
   * balance can never move without a matching ledger row. GREATEST(...,0)
   * clamps the balance so it can never go negative under concurrency.
   */
  private static async applyDelta(
    holderId: string,
    delta: number,
    reason: string,
    source: CreditSource,
    grantedBy: string | null,
    expiresAt: Date | null,
    offsetsLedgerId: string | null
  ): Promise<number> {
    const row = await DataService.queryOne<{ balance_after: number }>(
      `WITH updated AS (
         UPDATE users
         SET credit_balance = GREATEST(COALESCE(credit_balance, 0) + $2, 0),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, credit_balance
       ),
       logged AS (
         INSERT INTO credit_ledger (
           user_id, delta, balance_after, reason, granted_by, expires_at,
           source, offsets_ledger_id
         )
         SELECT updated.id,
                $2,
                updated.credit_balance,
                $3,
                $4,
                $5,
                $6,
                $7
         FROM updated
         RETURNING balance_after
       )
       SELECT balance_after FROM logged`,
      [holderId, delta, reason, grantedBy, expiresAt, source, offsetsLedgerId]
    );

    if (!row) {
      throw new Error('Account not found');
    }

    return row.balance_after;
  }

  /**
   * Grant bonus credits to an account.
   */
  static async grantCredits(
    userId: string,
    amount: number,
    reason: string,
    adminId: string,
    expiresAt: Date | null = null
  ): Promise<{ balance: number; holderId: string }> {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Credit amount must be a positive whole number');
    }

    const holderId = await CreditService.resolveCreditHolder(userId);
    const balance = await CreditService.applyDelta(
      holderId,
      amount,
      reason,
      'admin_grant',
      adminId,
      expiresAt,
      null
    );

    return { balance, holderId };
  }

  /**
   * Revoke unused credits. Revoking more than the balance clamps to zero
   * rather than producing a negative balance.
   */
  static async revokeCredits(
    userId: string,
    amount: number | 'all',
    reason: string,
    adminId: string
  ): Promise<{ balance: number; revoked: number }> {
    const holderId = await CreditService.resolveCreditHolder(userId);
    const current = await CreditService.getBalance(holderId);

    const requested = amount === 'all' ? current : amount;

    if (amount !== 'all' && (!Number.isInteger(requested) || requested <= 0)) {
      throw new Error('Credit amount must be a positive whole number');
    }

    const revoked = Math.min(current, requested);

    if (revoked === 0) {
      return { balance: current, revoked: 0 };
    }

    const balance = await CreditService.applyDelta(
      holderId,
      -revoked,
      reason,
      'admin_revoke',
      adminId,
      null,
      null
    );

    return { balance, revoked };
  }

  /**
   * Consume one credit for a document send.
   *
   * Returns false when there was no credit to spend, so the caller can refuse
   * the action rather than letting it through unmetered.
   */
  static async consumeCredit(userId: string, documentId: string | null = null): Promise<boolean> {
    const holderId = await CreditService.resolveCreditHolder(userId);

    // Conditional UPDATE: only decrements when a credit actually exists, so
    // two concurrent sends cannot spend the same last credit.
    const row = await DataService.queryOne<{ credit_balance: number }>(
      `UPDATE users
       SET credit_balance = credit_balance - 1, updated_at = NOW()
       WHERE id = $1 AND COALESCE(credit_balance, 0) > 0
       RETURNING credit_balance`,
      [holderId]
    );

    if (!row) {
      return false;
    }

    await DataService.queryOne(
      `INSERT INTO credit_ledger (
         user_id, delta, balance_after, reason, source, related_document_id
       )
       VALUES ($1, -1, $2, $3, 'consumption', $4)
       RETURNING id`,
      [holderId, row.credit_balance, 'Document sent beyond plan quota', documentId]
    );

    return true;
  }

  /**
   * Ledger history for an account, newest first.
   */
  static async getLedger(
    userId: string,
    page = 1,
    limit = 50
  ): Promise<{ items: CreditLedgerRow[]; total: number; page: number; totalPages: number }> {
    const holderId = await CreditService.resolveCreditHolder(userId);
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(200, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const countRow = await DataService.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id = $1',
      [holderId]
    );
    const total = parseInt(countRow?.count || '0', 10);

    const items = await DataService.queryAll<CreditLedgerRow>(
      `SELECT l.id, l.delta, l.balance_after, l.reason, l.source, l.expires_at,
              l.created_at, granter.email AS granted_by_email
       FROM credit_ledger l
       LEFT JOIN users granter ON granter.id = l.granted_by
       WHERE l.user_id = $1
       ORDER BY l.created_at DESC
       LIMIT $2 OFFSET $3`,
      [holderId, safeLimit, offset]
    );

    return { items, total, page: safePage, totalPages: Math.ceil(total / safeLimit) || 1 };
  }

  /**
   * Expire credit grants whose expires_at has passed.
   *
   * Writes an offsetting 'expiry' row rather than editing the original grant,
   * keeping the ledger append-only. Only grants that have not already been
   * offset are considered.
   */
  static async expireCredits(): Promise<{ grantsExpired: number; creditsExpired: number }> {
    const expiring = await DataService.queryAll<{ id: string; user_id: string; delta: number }>(
      `SELECT g.id, g.user_id, g.delta
       FROM credit_ledger g
       WHERE g.source = 'admin_grant'
         AND g.expires_at IS NOT NULL
         AND g.expires_at <= NOW()
         AND NOT EXISTS (
           SELECT 1 FROM credit_ledger e
           WHERE e.source = 'expiry' AND e.offsets_ledger_id = g.id
         )
       ORDER BY g.created_at ASC`
    );

    let creditsExpired = 0;
    let grantsExpired = 0;

    for (const grant of expiring) {
      // Only claw back what is still unspent — a grant the user already
      // consumed must not push the balance down a second time.
      const balance = await CreditService.getBalance(grant.user_id);
      const toExpire = Math.min(balance, grant.delta);

      // Always write the offsetting row, even at zero, so the job does not
      // re-examine this grant on every future run.
      await CreditService.applyDelta(
        grant.user_id,
        -toExpire,
        toExpire > 0 ? 'Credit grant expired' : 'Credit grant expired (already consumed)',
        'expiry',
        null,
        null,
        grant.id
      );

      creditsExpired += toExpire;
      grantsExpired++;
    }

    return { grantsExpired, creditsExpired };
  }
}

export default CreditService;
