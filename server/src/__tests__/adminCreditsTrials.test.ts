import request from 'supertest';
import app from '../app';
import { DataService } from '../services/DataService';
import { CreditService } from '../services/creditService';
import { AdminBillingService } from '../services/adminBillingService';
import { SubscriptionService } from '../services/subscriptionService';
import {
  createUser,
  cleanupFixtures,
  waitForSchema,
  FIXTURE_PASSWORD,
  FixtureUser,
} from './helpers/adminTestContext';

/**
 * Task: Tests - credit ledger integrity and trial expiry.
 *
 * The ledger keeps a denormalised running total, so the invariant that matters
 * is that users.credit_balance never drifts from SUM(credit_ledger.delta) —
 * including under concurrent spending.
 */
describe('Credit ledger integrity and trial expiry', () => {
  let admin: FixtureUser;
  let customer: FixtureUser;
  let stepUpToken = '';

  /** Assert the denormalised balance still equals the ledger sum. */
  async function assertLedgerConsistent(userId: string): Promise<number> {
    const row = await DataService.queryOne<{ ledger_sum: string; balance: number }>(
      `SELECT COALESCE((SELECT SUM(delta) FROM credit_ledger WHERE user_id = $1), 0) AS ledger_sum,
              COALESCE((SELECT credit_balance FROM users WHERE id = $1), 0) AS balance`,
      [userId]
    );

    const sum = parseInt(row?.ledger_sum || '0', 10);
    expect(sum).toBe(row?.balance);
    return sum;
  }

  beforeAll(async () => {
    await waitForSchema();
    await cleanupFixtures();

    admin = await createUser('credit_admin', 'platform_admin');
    customer = await createUser('credit_customer', 'user');

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

  it('rejects zero, negative and fractional amounts', async () => {
    for (const amount of [0, -5, 2.5]) {
      const response = await request(app)
        .post(`/api/admin/accounts/${customer.id}/credits`)
        .set('Authorization', `Bearer ${stepUpToken}`)
        .send({ action: 'grant', amount, reason: 'invalid' });

      expect(response.status).toBe(400);
    }
  });

  it('requires a reason', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/credits`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'grant', amount: 5 });

    expect(response.status).toBe(400);
  });

  it('grants credits and records the acting admin in the ledger', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/credits`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'grant', amount: 10, reason: 'support goodwill' });

    expect(response.status).toBe(200);
    expect(response.body.data.balance).toBe(10);

    const ledger = await request(app)
      .get(`/api/admin/accounts/${customer.id}/credits`)
      .set('Authorization', `Bearer ${stepUpToken}`);

    expect(ledger.body.data.balance).toBe(10);
    expect(ledger.body.data.ledger.items[0].granted_by_email).toBe(admin.email);
    expect(ledger.body.data.ledger.items[0].source).toBe('admin_grant');

    await assertLedgerConsistent(customer.id);
  });

  it('spends the plan quota before touching credits', async () => {
    // Fresh account, quota untouched: the send must come out of the quota.
    const fresh = await createUser('quota_first', 'user');
    await CreditService.grantCredits(fresh.id, 5, 'test', admin.id);

    const result = await SubscriptionService.consumeAllowance(fresh.id);

    expect(result.consumed).toBe('quota');
    expect(await CreditService.getBalance(fresh.id)).toBe(5);
  });

  it('falls through to credits once the quota is exhausted', async () => {
    const exhausted = await createUser('quota_spent', 'user');
    await CreditService.grantCredits(exhausted.id, 2, 'test', admin.id);

    await DataService.query(
      `INSERT INTO usage_tracking (user_id, month_year, documents_sent, documents_limit)
       VALUES ($1, to_char(NOW(), 'YYYY-MM'), 3, 3)
       ON CONFLICT (user_id, month_year)
       DO UPDATE SET documents_sent = 3, documents_limit = 3`,
      [exhausted.id]
    );

    const result = await SubscriptionService.consumeAllowance(exhausted.id);

    expect(result.consumed).toBe('credit');
    expect(await CreditService.getBalance(exhausted.id)).toBe(1);
    await assertLedgerConsistent(exhausted.id);
  });

  it('never lets the balance go negative under concurrent spending', async () => {
    const racer = await createUser('credit_race', 'user');
    await CreditService.grantCredits(racer.id, 3, 'race test', admin.id);

    // Ten concurrent claims against three credits: exactly three may win.
    const results = await Promise.all(
      Array.from({ length: 10 }, () => CreditService.consumeCredit(racer.id))
    );

    expect(results.filter(Boolean).length).toBe(3);
    expect(await CreditService.getBalance(racer.id)).toBe(0);
    await assertLedgerConsistent(racer.id);
  });

  it('clamps a revoke larger than the balance instead of going negative', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/credits`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'revoke', amount: 9999, reason: 'clamp test' });

    expect(response.status).toBe(200);
    expect(response.body.data.balance).toBe(0);
    expect(response.body.data.revoked).toBe(10);

    await assertLedgerConsistent(customer.id);
  });

  it('grants a trial that applies the plan limits immediately', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/trial`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ plan: 'team', duration_days: 14, reason: 'evaluation' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('trialing');

    const state = await DataService.queryOne<{ status: string; documents_limit: number }>(
      `SELECT s.status, ut.documents_limit
       FROM subscriptions s
       LEFT JOIN usage_tracking ut ON ut.user_id = s.user_id AND ut.month_year = to_char(NOW(), 'YYYY-MM')
       WHERE s.user_id = $1`,
      [customer.id]
    );

    expect(state?.status).toBe('trialing');
    expect(state?.documents_limit).toBe(200);
  });

  it('rejects an out-of-range trial duration', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${customer.id}/trial`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ plan: 'team', duration_days: 9999, reason: 'too long' });

    expect(response.status).toBe(400);
  });

  it('reverts an expired trial to free and is idempotent', async () => {
    // Backdate the expiry so the sweep picks it up.
    await DataService.query(
      "UPDATE subscriptions SET trial_ends_at = NOW() - INTERVAL '1 day' WHERE user_id = $1",
      [customer.id]
    );

    const first = await AdminBillingService.expireTrials();
    expect(first.expired).toBeGreaterThanOrEqual(1);

    const state = await DataService.queryOne<{ plan: string; status: string; trial_ends_at: Date | null }>(
      'SELECT plan, status, trial_ends_at FROM subscriptions WHERE user_id = $1',
      [customer.id]
    );

    expect(state?.plan).toBe('free');
    expect(state?.status).toBe('active');
    expect(state?.trial_ends_at).toBeNull();

    // A second sweep the same day must find nothing left to do.
    const second = await AdminBillingService.expireTrials();
    expect(second.userIds).not.toContain(customer.id);
  });

  it('expires a credit grant once, writing an offsetting entry', async () => {
    const expiring = await createUser('credit_expiry', 'user');
    await CreditService.grantCredits(expiring.id, 4, 'expiring grant', admin.id, new Date(Date.now() - 1000));

    const first = await CreditService.expireCredits();
    expect(first.creditsExpired).toBeGreaterThanOrEqual(4);
    expect(await CreditService.getBalance(expiring.id)).toBe(0);

    // Idempotent: the offsetting row links back to the grant, so a second run
    // must not claw back anything again.
    const second = await CreditService.expireCredits();
    const balanceAfter = await CreditService.getBalance(expiring.id);

    expect(balanceAfter).toBe(0);
    expect(second.grantsExpired).toBe(0);
    await assertLedgerConsistent(expiring.id);
  });
});
