-- Seed a platform administrator for admin-portal API tests.
--
-- platform_admin has NO self-registration endpoint by design (staff accounts
-- are designated explicitly, never self-served), so there is no producer API
-- to depend on. Per MUST-49 this is seeded here instead.
--
-- Password: PlatformAdmin123!  (bcrypt, 10 rounds — matches config.bcryptRounds)
-- Keep the email in sync with testCredentials.platform_admin in
-- tests/config/test-config.json.
--
-- SAFETY: test fixture only. Idempotent insert, never UPDATE/DELETE of
-- existing data, and only ever run against the test database.

INSERT INTO users (email, password_hash, name, role, access_status)
VALUES (
  'qa_platform_admin@example.com',
  '$2b$10$/P4nZ4hqUjixcqr1Pyk52.EcZzWR.PzfYfs6Z7CEXqAMyMqbRhfQq',
  'QA Platform Admin',
  'platform_admin',
  'active'
)
ON CONFLICT (email) DO NOTHING;
