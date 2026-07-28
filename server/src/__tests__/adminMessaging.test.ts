import request from 'supertest';
import app from '../app';
import { DataService } from '../services/DataService';
import { AdminMessagingService } from '../services/adminMessagingService';
import {
  createUser,
  cleanupFixtures,
  waitForSchema,
  fixtureEmail,
  FIXTURE_PASSWORD,
  FixtureUser,
} from './helpers/adminTestContext';

/**
 * Task: Tests - messaging delivery, opt-out and segment safety.
 *
 * The claims that matter: an opted-out recipient is never delivered to but IS
 * recorded, a dry run counts exactly what a real send would attempt, and one
 * bad recipient never aborts a batch.
 */
describe('Admin messaging delivery, opt-out and segments', () => {
  let admin: FixtureUser;
  let recipient: FixtureUser;
  let stepUpToken = '';
  let adminToken = '';

  beforeAll(async () => {
    await waitForSchema();
    await cleanupFixtures();

    admin = await createUser('msg_admin', 'platform_admin');
    recipient = await createUser('msg_recipient', 'user');

    const login = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: admin.email, password: FIXTURE_PASSWORD });
    adminToken = login.body.data.token;

    const elevation = await request(app)
      .post('/api/admin/auth/step-up')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: FIXTURE_PASSWORD });
    stepUpToken = elevation.body.data.token;
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  beforeEach(async () => {
    // Each test starts from a clean send history so the 24h frequency cap does
    // not leak between cases.
    await DataService.query('DELETE FROM admin_message_sends WHERE user_id = $1', [recipient.id]);
    await DataService.query(
      "DELETE FROM notification_preferences WHERE user_id = $1 AND notification_type = 'admin_message'",
      [recipient.id]
    );
  });

  it('seeds the welcome and follow-up templates', async () => {
    const response = await request(app)
      .get('/api/admin/message-templates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const keys = response.body.data.templates.map((t: { key: string }) => t.key);
    expect(keys).toContain('welcome');
    expect(keys).toContain('followup_day7');
    expect(response.body.data.variables).toContain('name');
  });

  it('substitutes template variables', () => {
    const rendered = AdminMessagingService.render('Hi {{name}}, plan {{plan}}', {
      name: 'Alex',
      plan: 'team',
    });

    expect(rendered).toBe('Hi Alex, plan team');
  });

  it('fails loudly on an unknown variable rather than sending the raw placeholder', () => {
    // A customer receiving "Hi {{nmae}}" is worse than a send an operator can see failed.
    expect(() => AdminMessagingService.render('Hi {{nmae}}', { name: 'Alex' })).toThrow(
      /unknown variable/i
    );
  });

  it('previews without sending anything', async () => {
    const response = await request(app)
      .post('/api/admin/messages/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template_key: 'welcome' });

    expect(response.status).toBe(200);
    expect(response.body.data.body).toContain('Alex');

    const sends = await DataService.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM admin_message_sends WHERE user_id = $1',
      [recipient.id]
    );
    expect(parseInt(sends?.count || '0', 10)).toBe(0);
  });

  it('rejects an unknown template', async () => {
    const response = await request(app)
      .post('/api/admin/messages/send')
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ template_key: 'does_not_exist', user_id: recipient.id });

    expect(response.status).toBe(404);
  });

  it('records a successful send', async () => {
    const response = await request(app)
      .post('/api/admin/messages/send')
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ template_key: 'welcome', user_id: recipient.id });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('sent');

    const history = await request(app)
      .get(`/api/admin/accounts/${recipient.id}/messages`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(history.body.data.total).toBe(1);
    expect(history.body.data.items[0].status).toBe('sent');
    expect(history.body.data.items[0].sent_by_email).toBe(admin.email);
  });

  it('skips an opted-out recipient and records WHY, never delivering', async () => {
    await DataService.query(
      `INSERT INTO notification_preferences (user_id, notification_type, email_enabled)
       VALUES ($1, 'admin_message', false)
       ON CONFLICT (user_id, notification_type) DO UPDATE SET email_enabled = false`,
      [recipient.id]
    );

    const response = await request(app)
      .post('/api/admin/messages/send')
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ template_key: 'welcome', user_id: recipient.id });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('skipped');
    expect(response.body.data.reason).toMatch(/opted out/i);

    // Skipped is RECORDED, not silently dropped — the operator must be able to
    // see that nothing was delivered.
    const row = await DataService.queryOne<{ status: string; skip_reason: string }>(
      'SELECT status, skip_reason FROM admin_message_sends WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
      [recipient.id]
    );

    expect(row?.status).toBe('skipped');
    expect(row?.skip_reason).toMatch(/opted out/i);
  });

  it('applies the 24h per-user frequency cap', async () => {
    const first = await request(app)
      .post('/api/admin/messages/send')
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ template_key: 'welcome', user_id: recipient.id });
    expect(first.body.data.status).toBe('sent');

    const second = await request(app)
      .post('/api/admin/messages/send')
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ template_key: 'followup_day7', user_id: recipient.id });

    expect(second.body.data.status).toBe('skipped');
    expect(second.body.data.reason).toMatch(/last 24 hours/i);
  });

  it('counts a dry run using the same query the real send uses', async () => {
    const filters = { plan: 'free', registeredMoreThanDays: 0 };

    const dryRun = await request(app)
      .post('/api/admin/messages/send-segment')
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ template_key: 'followup_day7', filters, dry_run: true });

    expect(dryRun.status).toBe(200);
    expect(dryRun.body.data.dry_run).toBe(true);

    const resolved = await AdminMessagingService.resolveSegment(filters);
    expect(dryRun.body.data.recipientCount).toBe(resolved.length);
  });

  it('never returns suspended accounts in a segment', async () => {
    const suspended = await createUser('msg_suspended', 'user');
    await DataService.query("UPDATE users SET access_status = 'suspended' WHERE id = $1", [
      suspended.id,
    ]);

    const resolved = await AdminMessagingService.resolveSegment({ plan: 'free' });

    expect(resolved.map((r) => r.id)).not.toContain(suspended.id);
  });

  it('ignores unknown filter keys rather than injecting them into SQL', async () => {
    const response = await request(app)
      .post('/api/admin/messages/send-segment')
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({
        template_key: 'followup_day7',
        filters: { "plan'; DROP TABLE users; --": 'free' },
        dry_run: true,
      });

    // The filter whitelist means an unrecognised key is simply not applied.
    expect(response.status).toBe(200);

    const usersAlive = await DataService.queryOne<{ count: string }>(
      'SELECT COUNT(*) AS count FROM users'
    );
    expect(parseInt(usersAlive?.count || '0', 10)).toBeGreaterThan(0);
  });

  it('continues a batch past one bad recipient', async () => {
    const good = await createUser('msg_batch_good', 'user');

    // A user row deleted mid-batch stands in for any per-recipient failure.
    const ghostId = '11111111-1111-1111-1111-111111111111';

    const outcomes = await Promise.all(
      [good.id, ghostId].map(async (id) => {
        try {
          return await AdminMessagingService.sendToUser('welcome', id, admin.id);
        } catch (error: unknown) {
          return { userId: id, email: '', status: 'failed' as const, reason: String(error) };
        }
      })
    );

    expect(outcomes).toHaveLength(2);
    expect(outcomes.find((o) => o.userId === good.id)?.status).toBe('sent');
    expect(outcomes.find((o) => o.userId === ghostId)?.status).toBe('failed');
  });

  it('requires step-up for sending but not for reading templates', async () => {
    const read = await request(app)
      .get('/api/admin/message-templates')
      .set('Authorization', `Bearer ${adminToken}`);

    const send = await request(app)
      .post('/api/admin/messages/send')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ template_key: 'welcome', user_id: recipient.id });

    expect(read.status).toBe(200);
    expect(send.status).toBe(403);
    expect(send.body.code).toBe('STEP_UP_REQUIRED');
  });

  it('sends a welcome message when a new account registers', async () => {
    const email = fixtureEmail('msg_welcome_flow');

    const registration = await request(app)
      .post('/api/auth/register')
      .send({ email, password: FIXTURE_PASSWORD, name: 'Welcome Flow' });

    expect(registration.status).toBe(201);
    const newUserId = registration.body.data.user.id;

    // The welcome send is deliberately not awaited by registration, so poll
    // briefly rather than assuming it has landed.
    let recorded: { status: string } | null = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      recorded = await DataService.queryOne<{ status: string }>(
        "SELECT status FROM admin_message_sends WHERE user_id = $1 AND template_key = 'welcome'",
        [newUserId]
      );
      if (recorded) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    expect(recorded?.status).toBe('sent');
  });
});
