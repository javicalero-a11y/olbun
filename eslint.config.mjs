import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const rootDir = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: rootDir });

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },

  js.configs.recommended,

  /*
   * Next's shareable config is applied before ours because it sets its own
   * parser globally; the TypeScript block below re-asserts
   * @typescript-eslint/parser for TS files so that type-aware rules work.
   */
  ...compat.extends('next/core-web-vitals'),

  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: rootDir,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // SPEC §3: no `any` without an inline justification comment. The rule
      // stays an error; genuine exceptions carry an eslint-disable line whose
      // description explains why.
      '@typescript-eslint/no-explicit-any': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
    },
  },

  /*
   * SPEC §7.2 — tenancy is enforced at the data layer, never by individual
   * query authors. Only lib/db may touch the raw Prisma client; everything else
   * must go through the tenant-scoped DAL.
   */
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['lib/db/**', 'prisma/**', 'tests/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@prisma/client',
              message:
                'Import from the tenant-scoped data access layer in lib/db instead. The raw Prisma client bypasses organisation filtering (SPEC §7.2).',
            },
            {
              name: '@/lib/db/prisma',
              message:
                'The unscoped Prisma client is confined to lib/db. Use the tenant-scoped DAL instead (SPEC §7.2).',
            },
          ],
          patterns: [
            {
              group: ['**/lib/db/prisma'],
              message:
                'The unscoped Prisma client is confined to lib/db. Use the tenant-scoped DAL instead (SPEC §7.2).',
            },
          ],
        },
      ],
    },
  },

  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  prettier,
);
