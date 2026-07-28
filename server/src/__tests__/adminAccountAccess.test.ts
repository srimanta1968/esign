import request from 'supertest';
import app from '../app';
import { DataService } from '../services/DataService';
import {
  createUser,
  cleanupFixtures,
  waitForSchema,
  FIXTURE_PASSWORD,
  FixtureUser,
} from './helpers/adminTestContext';

/**
 * Task: Tests - account console and access revocation.
 *
 * The load-bearing claim is that revoking access takes effect IMMEDIATELY,
 * not when the victim's 7-day token happens to expire. That is only provable
 * against a live session.
 */
describe('Account console and access revocation', () => {
  let admin: FixtureUser;
  let victim: FixtureUser;
  let stepUpToken = '';
  let victimToken = '';

  beforeAll(async () => {
    await waitForSchema();
    await cleanupFixtures();

    admin = await createUser('access_admin', 'platform_admin');
    victim = await createUser('access_victim', 'user');

    const login = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: admin.email, password: FIXTURE_PASSWORD });

    const elevation = await request(app)
      .post('/api/admin/auth/step-up')
      .set('Authorization', `Bearer ${login.body.data.token}`)
      .send({ password: FIXTURE_PASSWORD });

    stepUpToken = elevation.body.data.token;

    const victimLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: victim.email, password: FIXTURE_PASSWORD });
    victimToken = victimLogin.body.data.token;
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it('lists accounts with pagination metadata', async () => {
    const response = await request(app)
      .get('/api/admin/accounts?limit=5&page=1')
      .set('Authorization', `Bearer ${stepUpToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.page).toBe(1);
    expect(response.body.data.limit).toBe(5);
    expect(Array.isArray(response.body.data.items)).toBe(true);
    expect(typeof response.body.data.total).toBe('number');
  });

  it('includes free-plan accounts that have no subscription row', async () => {
    const response = await request(app)
      .get(`/api/admin/accounts?search=${encodeURIComponent(victim.email)}`)
      .set('Authorization', `Bearer ${stepUpToken}`);

    const found = response.body.data.items.find((row: { id: string }) => row.id === victim.id);

    // A LEFT JOIN regression here would silently hide most of the platform.
    expect(found).toBeDefined();
    expect(found.plan).toBe('free');
    expect(typeof found.document_count).toBe('number');
  });

  it('returns 404 for an unknown account and 400 for a malformed id', async () => {
    const unknown = await request(app)
      .get('/api/admin/accounts/11111111-1111-1111-1111-111111111111')
      .set('Authorization', `Bearer ${stepUpToken}`);

    const malformed = await request(app)
      .get('/api/admin/accounts/not-a-uuid')
      .set('Authorization', `Bearer ${stepUpToken}`);

    expect(unknown.status).toBe(404);
    expect(malformed.status).toBe(400);
  });

  it('requires a reason', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${victim.id}/access`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'suspend' });

    expect(response.status).toBe(400);
  });

  it('refuses an unknown action', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${victim.id}/access`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'obliterate', reason: 'nope' });

    expect(response.status).toBe(400);
  });

  it('refuses an admin revoking their own access', async () => {
    const response = await request(app)
      .post(`/api/admin/accounts/${admin.id}/access`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'revoke', reason: 'self' });

    expect(response.status).toBe(400);
  });

  it('kills a live session the moment access is revoked', async () => {
    // The victim's token works right up until the revoke.
    const before = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${victimToken}`);
    expect(before.status).toBe(200);

    const revoke = await request(app)
      .post(`/api/admin/accounts/${victim.id}/access`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'revoke', reason: 'integration test' });
    expect(revoke.status).toBe(200);

    // Same token, next request — must now be refused without waiting for the
    // 7-day expiry.
    const after = await request(app)
      .get('/api/documents')
      .set('Authorization', `Bearer ${victimToken}`);

    expect(after.status).toBe(403);
    expect(after.body.code).toBe('ACCESS_REVOKED');
  });

  it('refuses login for a revoked account, distinctly from a bad password', async () => {
    const revoked = await request(app)
      .post('/api/auth/login')
      .send({ email: victim.email, password: FIXTURE_PASSWORD });

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: victim.email, password: 'TotallyWrong123!' });

    expect(revoked.status).toBe(403);
    expect(revoked.body.code).toBe('ACCESS_REVOKED');
    expect(wrongPassword.status).toBe(401);
  });

  it('writes an audit row with before and after values', async () => {
    const row = await DataService.queryOne<{ action: string; metadata: Record<string, unknown> }>(
      `SELECT action, metadata FROM audit_logs
       WHERE resource_type = 'admin_action' AND resource_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [victim.id]
    );

    expect(row?.action).toBe('admin.account.revoke');
    expect(row?.metadata).toMatchObject({
      before: { access_status: 'active' },
      after: { access_status: 'revoked' },
      reason: 'integration test',
    });
  });

  it('restores access and lets the user sign in again', async () => {
    const restore = await request(app)
      .post(`/api/admin/accounts/${victim.id}/access`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'restore', reason: 'integration test restore' });

    expect(restore.status).toBe(200);
    expect(restore.body.data.access_status).toBe('active');

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: victim.email, password: FIXTURE_PASSWORD });

    expect(login.status).toBe(200);
  });
});
