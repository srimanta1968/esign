/**
 * Jest configuration for the server test suite.
 *
 * The admin-portal tests are integration tests: they exercise real HTTP routes
 * against a real database, because the behaviour that matters here (a revoked
 * session dying mid-flight, a plan override moving three tables together, a
 * credit ledger that cannot drift) only exists at that level.
 *
 * Tests are excluded from the tsc build via tsconfig; ts-jest compiles them.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  // Integration tests share one database, so running files in parallel would
  // let them fight over the same fixture rows.
  maxWorkers: 1,
  testTimeout: 30000,
  clearMocks: true,
  // Importing the app starts its listener, migration timers and the database
  // pool. Those keep the event loop alive long after the assertions finish, so
  // the run is torn down explicitly rather than waiting on them.
  forceExit: true,
  setupFiles: ['<rootDir>/src/__tests__/helpers/jestSetup.ts'],
};
