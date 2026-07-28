import { DataService } from './DataService';
import { SubscriptionService } from './subscriptionService';

/**
 * Admin-side billing views and manual plan overrides.
 *
 * Reads payment history from the local `payments` mirror rather than calling
 * Stripe per account view. Stripe stays the source of truth — this table is a
 * read model fed by webhooks and the backfill script.
 */

/** Page size ceiling for payment history. */
const MAX_PAYMENT_PAGE_SIZE = 100;
const DEFAULT_PAYMENT_PAGE_SIZE = 25;

export type PaymentStatus = 'paid' | 'failed' | 'refunded' | 'pending';

export interface PaymentRow {
  id: string;
  stripe_invoice_id: string | null;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  hosted_invoice_url: string | null;
  invoice_pdf_url: string | null;
  period_start: Date | null;
  period_end: Date | null;
  paid_at: Date | null;
  created_at: Date;
}

export interface SubscriptionSummary {
  plan: string;
  status: string;
  seats: number;
  current_period_start: Date | null;
  current_period_end: Date | null;
  trial_ends_at: Date | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_manual_override: boolean;
  override_reason: string | null;
  override_at: Date | null;
  override_by_email: string | null;
}

export interface AccountBilling {
  subscription: SubscriptionSummary;
  payments: PaymentRow[];
  paymentsTotal: number;
  page: number;
  totalPages: number;
}

/** Subscription shape returned for an account with no subscriptions row. */
const FREE_SUBSCRIPTION: SubscriptionSummary = {
  plan: 'free',
  status: 'active',
  seats: 1,
  current_period_start: null,
  current_period_end: null,
  trial_ends_at: null,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  is_manual_override: false,
  override_reason: null,
  override_at: null,
  override_by_email: null,
};

export class AdminBillingService {
  /**
   * Subscription plus paginated payment history for one account.
   *
   * An account with no subscription and no payments is a normal free-plan
   * user, not an error — it returns the free defaults and an empty list.
   */
  static async getAccountBilling(
    userId: string,
    page = 1,
    limit = DEFAULT_PAYMENT_PAGE_SIZE
  ): Promise<AccountBilling> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(MAX_PAYMENT_PAGE_SIZE, Math.max(1, limit));
    const offset = (safePage - 1) * safeLimit;

    const subscription = await DataService.queryOne<SubscriptionSummary>(
      `SELECT s.plan, s.status, s.seats, s.current_period_start, s.current_period_end,
              s.trial_ends_at, s.stripe_customer_id, s.stripe_subscription_id,
              COALESCE(s.is_manual_override, false) AS is_manual_override,
              s.override_reason, s.override_at,
              overrider.email AS override_by_email
       FROM subscriptions s
       LEFT JOIN users overrider ON overrider.id = s.override_by
       WHERE s.user_id = $1`,
      [userId]
    );

    const countRow = await DataService.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM payments WHERE user_id = $1',
      [userId]
    );
    const paymentsTotal = parseInt(countRow?.count || '0', 10);

    const payments = await DataService.queryAll<PaymentRow>(
      `SELECT id, stripe_invoice_id, amount_cents, currency, status, description,
              hosted_invoice_url, invoice_pdf_url, period_start, period_end,
              paid_at, created_at
       FROM payments
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, safeLimit, offset]
    );

    return {
      subscription: subscription || FREE_SUBSCRIPTION,
      payments,
      paymentsTotal,
      page: safePage,
      totalPages: Math.ceil(paymentsTotal / safeLimit) || 1,
    };
  }

  /**
   * Apply a manual (comp) plan override.
   *
   * Delegates the plan change to SubscriptionService so the subscriptions row,
   * users.plan and the current month's usage limit all move together — the
   * same path the Stripe webhook uses — then marks the row as a manual
   * override so it is distinguishable from a paid subscription.
   */
  static async overridePlan(
    userId: string,
    plan: string,
    reason: string,
    adminId: string
  ): Promise<{ before: string; after: string; stripeSubscriptionId: string | null }> {
    const existing = await DataService.queryOne<{ plan: string; stripe_subscription_id: string | null }>(
      'SELECT plan, stripe_subscription_id FROM subscriptions WHERE user_id = $1',
      [userId]
    );

    const before = existing?.plan || 'free';

    await SubscriptionService.createOrUpdateSubscription(userId, plan, null, null, null, null);

    await DataService.queryOne(
      `UPDATE subscriptions
       SET is_manual_override = true, override_reason = $1, override_by = $2,
           override_at = NOW(), updated_at = NOW()
       WHERE user_id = $3
       RETURNING id`,
      [reason, adminId, userId]
    );

    return {
      before,
      after: plan,
      stripeSubscriptionId: existing?.stripe_subscription_id || null,
    };
  }

  /**
   * Insert or update a payment mirrored from a Stripe event.
   *
   * Keyed on stripe_invoice_id, which is UNIQUE, so Stripe's webhook retries
   * update the existing row instead of creating duplicates.
   */
  static async upsertPayment(params: {
    userId: string;
    stripeInvoiceId: string;
    stripeChargeId?: string | null;
    amountCents: number;
    currency: string;
    status: PaymentStatus;
    description?: string;
    invoicePdfUrl?: string | null;
    hostedInvoiceUrl?: string | null;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    paidAt?: Date | null;
  }): Promise<void> {
    await DataService.queryOne(
      `INSERT INTO payments (
         user_id, stripe_invoice_id, stripe_charge_id, amount_cents, currency,
         status, description, invoice_pdf_url, hosted_invoice_url,
         period_start, period_end, paid_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (stripe_invoice_id) DO UPDATE SET
         stripe_charge_id = COALESCE(EXCLUDED.stripe_charge_id, payments.stripe_charge_id),
         amount_cents = EXCLUDED.amount_cents,
         currency = EXCLUDED.currency,
         status = EXCLUDED.status,
         description = EXCLUDED.description,
         invoice_pdf_url = COALESCE(EXCLUDED.invoice_pdf_url, payments.invoice_pdf_url),
         hosted_invoice_url = COALESCE(EXCLUDED.hosted_invoice_url, payments.hosted_invoice_url),
         period_start = COALESCE(EXCLUDED.period_start, payments.period_start),
         period_end = COALESCE(EXCLUDED.period_end, payments.period_end),
         paid_at = COALESCE(EXCLUDED.paid_at, payments.paid_at),
         updated_at = NOW()
       RETURNING id`,
      [
        params.userId,
        params.stripeInvoiceId,
        params.stripeChargeId || null,
        params.amountCents,
        params.currency,
        params.status,
        params.description || '',
        params.invoicePdfUrl || null,
        params.hostedInvoiceUrl || null,
        params.periodStart || null,
        params.periodEnd || null,
        params.paidAt || null,
      ]
    );
  }

  /**
   * Resolve our user id from a Stripe customer id, so webhook events can be
   * attributed to an account.
   */
  static async findUserByStripeCustomer(stripeCustomerId: string): Promise<string | null> {
    const row = await DataService.queryOne<{ user_id: string }>(
      'SELECT user_id FROM subscriptions WHERE stripe_customer_id = $1',
      [stripeCustomerId]
    );

    return row?.user_id || null;
  }

  /**
   * Revenue figures for the portal's billing dashboard.
   */
  static async getRevenueMetrics(): Promise<{
    paidLast30Days: number;
    failedLast30Days: number;
    refundedLast30Days: number;
    accountsPastDue: number;
    manualOverrides: number;
  }> {
    const [totals, pastDue, overrides] = await Promise.all([
      DataService.queryOne<{
        paid: string;
        failed: string;
        refunded: string;
      }>(
        `SELECT
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS paid,
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'failed'), 0) AS failed,
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'refunded'), 0) AS refunded
         FROM payments
         WHERE created_at >= NOW() - INTERVAL '30 days'`
      ),
      DataService.queryOne<{ count: string }>(
        "SELECT COUNT(*) AS count FROM subscriptions WHERE status = 'past_due'"
      ),
      DataService.queryOne<{ count: string }>(
        'SELECT COUNT(*) AS count FROM subscriptions WHERE is_manual_override = true'
      ),
    ]);

    return {
      paidLast30Days: parseInt(totals?.paid || '0', 10),
      failedLast30Days: parseInt(totals?.failed || '0', 10),
      refundedLast30Days: parseInt(totals?.refunded || '0', 10),
      accountsPastDue: parseInt(pastDue?.count || '0', 10),
      manualOverrides: parseInt(overrides?.count || '0', 10),
    };
  }
}

export default AdminBillingService;
