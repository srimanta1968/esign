/**
 * Runs before the app module is imported by any test.
 *
 * Importing src/app.ts calls app.listen as a side effect. Supertest binds its
 * own ephemeral port and ignores that listener, but the app would still try to
 * take the configured PORT — colliding with a dev server on the default. Point
 * it at a port nothing else uses.
 */
process.env.PORT = process.env.TEST_PORT || '3399';

// Keep test output focused on assertion failures rather than migration and
// scheduler chatter from the imported app.
process.env.LOG_LEVEL = 'error';
