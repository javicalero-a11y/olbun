import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
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
        // SPEC §3: ≥80% on lib/ and all server actions.
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
