import request from 'supertest';
import app from '../app';
import { DataService } from '../services/DataService';
import { AdminBillingService } from '../services/adminBillingService';
import { PLAN_LIMITS } from '../services/stripeService';
import {
  createUser,
  cleanupFixtures,
  waitForSchema,
  FIXTURE_PASSWORD,
  FixtureUser,
} from './helpers/adminTestContext';

/**
 * Task: Tests - payment mirroring and plan override atomicity.
 *
 * The override replaces manual production SQL, so the guarantee that matters is
 * that subscriptions, users.plan and usage_tracking never disagree.
 */
describe('Payment mirroring and plan override', () => {
  let admin: FixtureUser;
  let customer: FixtureUser;
  let stepUpToken = '';

  beforeAll(async () => {
    await waitForSchema();
    await cleanupFixtures();

    admin = await createUser('billing_admin', 'platform_admin');
    customer = await createUser('billing_customer', 'user');

    const login = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: admin.email, password: FIXTURE_PASSWORD });

    const elevation = await request(app)
      .post('/api/admin/auth/step-up')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ password: FIXTURE_PASSWORD });

    stepUpToken = elevation.body.data.token;
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it('returns free-plan defaults for an account with no subscription', async () => {
    const response = await request(app)
      .get(`/api/admin/accounts/${customer.id}/billing`)
      .set('Authorization', `Bearer ${stepUpToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.subscription.plan).toBe('free');
    expect(response.body.data.subscription.is_manual_override).toBe(false);
    expect(response.body.data.payments).toEqual([]);
  });

  it('rejects an unknown plan', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/plan`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ plan: 'enterprise', reason: 'nope' });

    expect(response.status).toBe(400);
  });

  it('requires a reason', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/plan`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ plan: 'team' });

    expect(response.status).toBe(400);
  });

  it('moves subscriptions, users.plan and usage_tracking together', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/plan`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ plan: 'team', reason: 'comp upgrade' });

    expect(response.status).toBe(200);
    expect(response.body.data.plan).toBe('team');
    expect(response.body.data.is_manual_override).toBe(true);

    const state = await DataService.queryOne<{
      user_plan: string;
      sub_plan: string;
      is_manual_override: boolean;
      documents_limit: number;
    }>(
      `SELECT u.plan AS user_plan, s.plan AS sub_plan, s.is_manual_override, ut.documents_limit
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id
       LEFT JOIN usage_tracking ut ON ut.user_id = u.id AND ut.month_year = to_char(NOW(), 'YYYY-MM')
       WHERE u.id = $1`,
      [customer.id]
    );

    // All three must agree — a partial write here is the exact failure the
    // manual SQL process used to risk.
    expect(state?.user_plan).toBe('team');
    expect(state?.sub_plan).toBe('team');
    expect(state?.is_manual_override).toBe(true);
    expect(state?.documents_limit).toBe(PLAN_LIMITS.team);
  });

  it('records the override in the audit log', async () => {
    const row = await DataService.queryOne<{ action: string; metadata: Record<string, unknown> }>(
      `SELECT action, metadata FROM audit_logs
       WHERE resource_type = 'admin_action' AND resource_id = $1 AND action = 'admin.plan.override'
       ORDER BY created_at DESC LIMIT 1`,
      [customer.id]
    );

    expect(row?.action).toBe('admin.plan.override');
    expect(row?.metadata).toMatchObject({ after: { plan: 'team' }, reason: 'comp upgrade' });
  });

  it('mirrors a payment and stays idempotent across webhook retries', async () => {
    const invoiceId = `in_test_${process.pid}`;

    await AdminBillingService.upsertPayment({
      userId: customer.id,
      stripeInvoiceId: invoiceId,
      amountCents: 899,
      currency: 'usd',
      status: 'paid',
      description: 'Team monthly',
    });

    // Stripe retries webhooks. The second delivery must update, not duplicate.
    await AdminBillingService.upsertPayment({
      userId: customer.id,
      stripeInvoiceId: invoiceId,
      amountCents: 899,
      currency: 'usd',
      status: 'paid',
      description: 'Team monthly',
    });

    const count = await DataService.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM payments WHERE stripe_invoice_id = $1',
      [invoiceId]
    );

    expect(parseInt(count?.count || '0', 10)).toBe(1);
  });

  it('surfaces the mirrored payment on the billing view', async () => {
    const response = await request(app)
      .get(`/api/admin/accounts/${customer.id}/billing`)
      .set('Authorization', `Bearer ${stepUpToken}`);

    expect(response.body.data.paymentsTotal).toBe(1);
    expect(response.body.data.payments[0].amount_cents).toBe(899);
    expect(response.body.data.payments[0].status).toBe('paid');
  });

  it('reports a failed payment in the revenue metrics', async () => {
    await AdminBillingService.upsertPayment({
      userId: customer.id,
      stripeInvoiceId: `in_failed_${process.pid}`,
      amountCents: 899,
      currency: 'usd',
      status: 'failed',
      description: 'Failed charge',
    });

    const response = await request(app)
      .get('/api/admin/metrics/revenue')
      .set('Authorization', `Bearer ${stepUpToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.failedLast30Days).toBeGreaterThanOrEqual(899);
    expect(response.body.data.manualOverrides).toBeGreaterThanOrEqual(1);
  });
});
