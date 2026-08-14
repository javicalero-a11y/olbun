import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // See tests/stubs/server-only.ts for why.
      'server-only': fileURLToPath(new URL('./tests/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['lib/**/*.test.ts', 'tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/**/*.test.ts',
        // Infrastructure adapters: they import `server-only` and hold no
        // branching logic of their own. The data access layer is covered by
        // integration tests against a real Postgres instead (SPEC §13).
        'lib/db/**',
        'lib/logger.ts',
      ],
      thresholds: {
        // Ratchet from the measured 2026-08-14 baseline (ADR 0008). These are
        // floors, not the destination: each tested milestone raises them until
        // SPEC's 80% target is real rather than a permanently red CI setting.
        lines: 56,
        functions: 55,
        branches: 49,
        statements: 57,
      },
    },
  },
});
