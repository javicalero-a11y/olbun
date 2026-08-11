import { z } from 'zod';

/**
 * Environment validation (SPEC §7.4: "Secrets from env only, validated at boot
 * with Zod — the app refuses to start with a missing or malformed secret").
 *
 * Add new variables here as milestones introduce them. Never read
 * `process.env` directly outside this file.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Postgres connection string used by Prisma. */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /** Canonical origin of the app, used for links in emails and redirects. */
  APP_URL: z.url().default('http://localhost:3000'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type ServerEnv = z.infer<typeof serverSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

/**
 * Parses and returns the server environment, throwing a readable error when
 * anything is missing or malformed. Exported separately from the cached
 * singleton so tests can exercise it against arbitrary inputs.
 */
export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = serverSchema.safeParse(source);

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${formatIssues(parsed.error)}\n\n` +
        'See .env.example for the expected variables.',
    );
  }

  return parsed.data;
}

let cached: ServerEnv | undefined;

/**
 * The validated server environment. Lazily parsed so that importing this module
 * from a client bundle or a test harness does not eagerly throw.
 */
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** Test-only escape hatch so the cache does not leak between test cases. */
export function resetServerEnvCache(): void {
  cached = undefined;
}
