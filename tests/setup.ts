/**
 * Test environment defaults.
 *
 * Server modules import `lib/logger`, which validates the environment at import
 * time — so unit-testing any of them requires the variables to be present.
 * These are inert placeholders: unit tests never open a connection, and the
 * integration suite overrides DATABASE_URL with its Testcontainers instance.
 */
process.env['DATABASE_URL'] ??= 'postgresql://olbun_app:test@localhost:5433/olbun_test';
process.env['DIRECT_DATABASE_URL'] ??= 'postgresql://olbun:test@localhost:5433/olbun_test';
process.env['AUTH_SECRET'] ??= 'test-secret-not-used-for-anything-real-000';
process.env['LOG_LEVEL'] ??= 'fatal';
