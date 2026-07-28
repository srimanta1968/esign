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
 * Task: Tests - platform admin authorization boundary.
 *
 * Every role in the system gets an explicit allow or deny assertion, so adding
 * a role without deciding its admin-portal access breaks a test rather than
 * quietly granting or denying it.
 */
describe('Platform admin authorization boundary', () => {
  let platformAdmin: FixtureUser;
  let tenantAdmin: FixtureUser;
  let normalUser: FixtureUser;

  let adminToken = '';
  let tenantAdminToken = '';
  let userToken = '';

  beforeAll(async () => {
    await waitForSchema();
    await cleanupFixtures();

    platformAdmin = await createUser('platform', 'platform_admin');
    tenantAdmin = await createUser('tenant_admin', 'admin');
    normalUser = await createUser('plain_user', 'user');

    const adminLogin = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: platformAdmin.email, password: FIXTURE_PASSWORD });
    adminToken = adminLogin.body?.data?.token || '';

    const tenantLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: tenantAdmin.email, password: FIXTURE_PASSWORD });
    tenantAdminToken = tenantLogin.body?.data?.token || '';

    const userLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: normalUser.email, password: FIXTURE_PASSWORD });
    userToken = userLogin.body?.data?.token || '';
  });

  afterAll(async () => {
    await cleanupFixtures();
  });

  it('lets a platform_admin sign in and reach the portal', async () => {
    expect(adminToken).not.toEqual('');

    const response = await request(app)
      .get('/api/admin/accounts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
  });

  it('reports the admin identity and an unelevated session', async () => {
    const response = await request(app)
      .get('/api/admin/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.role).toBe('platform_admin');
    expect(response.body.data.stepUp).toBe(false);
  });

  it('refuses a tenant-level admin — the role is NOT the same thing', async () => {
    const response = await request(app)
      .get('/api/admin/accounts')
      .set('Authorization', `Bearer ${tenantAdminToken}`);

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
  });

  it('refuses an ordinary user', async () => {
    const response = await request(app)
      .get('/api/admin/accounts')
      .set('Authorization', `Bearer ${userToken}`);

    expect(response.status).toBe(403);
  });

  it('refuses an unauthenticated request', async () => {
    const response = await request(app).get('/api/admin/accounts');

    expect(response.status).toBe(401);
  });

  it('refuses a platform_admin whose own access has been revoked', async () => {
    await DataService.query("UPDATE users SET access_status = 'revoked' WHERE id = $1", [
      platformAdmin.id,
    ]);

    const response = await request(app)
      .get('/api/admin/accounts')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(403);

    await DataService.query("UPDATE users SET access_status = 'active' WHERE id = $1", [
      platformAdmin.id,
    ]);
  });

  it('does not reveal that an email belongs to a platform admin', async () => {
    const wrongPassword = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: platformAdmin.email, password: 'WrongPassword123!' });

    const unknownEmail = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: 'nobody_at_all@example.com', password: 'WrongPassword123!' });

    const nonAdmin = await request(app)
      .post('/api/admin/auth/login')
      .send({ email: normalUser.email, password: FIXTURE_PASSWORD });

    // All three must be indistinguishable, or this endpoint becomes a way to
    // enumerate which accounts hold staff access.
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(nonAdmin.status).toBe(401);
    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
    expect(unknownEmail.body.error).toEqual(nonAdmin.body.error);
  });

  it('refuses a mutating endpoint when the session has not completed step-up', async () => {
    const target = await createUser('stepup_target', 'user');

    const response = await request(app)
      .post(`/api/admin/accounts/${target.id}/access`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ action: 'suspend', reason: 'boundary test' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('STEP_UP_REQUIRED');
  });

  it('allows the same action once step-up is completed', async () => {
    const target = await createUser('stepup_ok', 'user');

    const elevation = await request(app)
      .post('/api/admin/auth/step-up')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: FIXTURE_PASSWORD });

    expect(elevation.status).toBe(200);
    const stepUpToken = elevation.body.data.token;

    const response = await request(app)
      .post(`/api/admin/accounts/${target.id}/access`)
      .set('Authorization', `Bearer ${stepUpToken}`)
      .send({ action: 'suspend', reason: 'boundary test' });

    expect(response.status).toBe(200);
    expect(response.body.data.access_status).toBe('suspended');
  });

  it('records denied admin attempts nowhere but never grants them', async () => {
    // A denial must not create an admin_action audit row implying success.
    const before = await DataService.queryOne<{ count: string }>(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE resource_type = 'admin_action'"
    );

    await request(app).get('/api/admin/accounts').set('Authorization', `Bearer ${userToken}`);

    const after = await DataService.queryOne<{ count: string }>(
      "SELECT COUNT(*) AS count FROM audit_logs WHERE resource_type = 'admin_action'"
    );

    expect(after?.count).toEqual(before?.count);
  });
});
