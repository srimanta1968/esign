import bcrypt from 'bcrypt';
import { DataService } from '../../services/DataService';

/**
 * Shared fixtures for the admin-portal integration tests.
 *
 * These tests run against a REAL database because the behaviour under test is
 * database behaviour: a revoked session dying mid-flight, three tables moving
 * together, a ledger that must never drift from its running total. Mocking the
 * data layer would test the mock.
 */

/** Password used for every fixture account. */
export const FIXTURE_PASSWORD = 'FixturePass123!';

/** Emails are namespaced so a failed run cannot collide with real accounts. */
const FIXTURE_PREFIX = 'jest_admin_fixture_';

export interface FixtureUser {
  id: string;
  email: string;
}

/** Unique fixture email for one test run. */
export function fixtureEmail(label: string): string {
  return `${FIXTURE_PREFIX}${label}_${process.pid}@example.com`;
}

/**
 * Wait until migrations have created the tables these tests depend on.
 *
 * Importing the app kicks off migrations asynchronously, so a test that queries
 * immediately can race the schema into existence.
 */
export async function waitForSchema(timeoutMs = 25000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    try {
      const row = await DataService.queryOne<{ ready: boolean }>(
        `SELECT (
           to_regclass('public.credit_ledger') IS NOT NULL AND
           to_regclass('public.payments') IS NOT NULL AND
           to_regclass('public.admin_message_sends') IS NOT NULL
         ) AS ready`
      );

      if (row?.ready) {
        return;
      }
    } catch {
      // Database not reachable yet — keep waiting until the deadline.
    }

    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for migrations. Is the test database running?');
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

/**
 * Create a user directly in the database.
 *
 * platform_admin accounts have no registration endpoint by design, so they can
 * only be created this way.
 */
export async function createUser(
  label: string,
  role: 'user' | 'admin' | 'platform_admin'
): Promise<FixtureUser> {
  const email = fixtureEmail(label);
  const hash = await bcrypt.hash(FIXTURE_PASSWORD, 10);

  const row = await DataService.queryOne<FixtureUser>(
    `INSERT INTO users (email, password_hash, name, role, access_status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (email) DO UPDATE SET role = EXCLUDED.role, access_status = 'active'
     RETURNING id, email`,
    [email, hash, `Fixture ${label}`, role]
  );

  if (!row) {
    throw new Error(`Failed to create fixture user "${label}"`);
  }

  return row;
}

/** Remove every fixture row this process created. */
export async function cleanupFixtures(): Promise<void> {
  await DataService.query('DELETE FROM users WHERE email LIKE $1', [`${FIXTURE_PREFIX}%`]);
}
