/**
 * `server-only` throws when imported outside a React Server Component, which is
 * exactly its job — and which makes any module that imports it untestable under
 * Vitest. The test runner aliases the package to this no-op so server modules
 * can be unit-tested directly; the real guard still applies in the app build.
 */
export {};
