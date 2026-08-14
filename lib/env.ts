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

  /**
   * Postgres connection for the running application. Must point at a
   * NON-superuser role, or row-level security is silently bypassed.
   */
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  /** Owner-role connection used only by migrations and seeds. */
  DIRECT_DATABASE_URL: z.string().min(1, 'DIRECT_DATABASE_URL is required'),

  /** Signs session tokens. Auth.js reads it from the environment directly. */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),

  /**
   * 32 bytes, base64. Encrypts TOTP secrets and, from M11, personal data.
   * Rotating it changes the key id embedded in every new ciphertext.
   */
  ENCRYPTION_KEY: z.string().min(44, 'ENCRYPTION_KEY must be 32 bytes encoded as base64'),

  /** Canonical origin of the app, used for links in emails and redirects. */
  APP_URL: z.url().default('http://localhost:3100'),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),

  /**
   * Google sign-in. Optional on purpose: a developer without a Google Cloud
   * project still gets a working app, just without that button. Both halves
   * are required together — half a credential silently produces a provider
   * that fails only when somebody clicks it.
   */
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  /**
   * Microsoft Entra ID (work and school accounts). Optional on the same terms
   * as Google. `MICROSOFT_TENANT_ID` narrows sign-in to one directory; left
   * unset, any Entra directory may sign in — which is what a product sold to
   * many different companies actually wants.
   */
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
  MICROSOFT_TENANT_ID: z.string().min(1).optional(),

  /** From: address for magic links. Falls back to a no-reply on APP_URL's host. */
  AUTH_EMAIL_FROM: z.email().optional(),
  MAIL_TRANSPORT: z.enum(['console', 'smtp']).optional(),
  SMTP_URL: z.string().min(1).optional(),

  /** Domain displayed for contract-specific forwarding aliases (M6). */
  INBOUND_EMAIL_DOMAIN: z.string().min(3).default('entrada.olbun.local'),

  /**
   * Shared secret used by the inbound mail provider when it posts the raw
   * RFC 822 message. Optional locally; the webhook refuses every request while
   * it is absent, so a deployment can never expose an unauthenticated inlet.
   */
  INBOUND_EMAIL_SECRET: z.string().min(32).optional(),

  /**
   * Detection (M7). Optional on the same terms as the sign-in providers: with
   * no key the local rule engine runs instead, so the product works on a
   * laptop without one — weaker, and labelled as such on every detection it
   * produces.
   */
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  /**
   * Forces one engine regardless of the key. `reglas` is what the end-to-end
   * suite sets: a test run must not depend on a network call, and it must
   * certainly not spend money because somebody added a key to their `.env`.
   */
  MOTOR_DETECCION: z.enum(['claude', 'reglas']).optional(),

  /**
   * Object storage for documents (M9). S3-compatible: MinIO in development,
   * real S3 or equivalent in production. Required — unlike the optional
   * sign-in providers, a document store that silently is not there would mean
   * uploads that appear to work and evidence that is not kept.
   */
  S3_ENDPOINT: z.url().default('http://localhost:9000'),
  S3_REGION: z.string().min(1).default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('olbun-documentos'),
  S3_ACCESS_KEY: z.string().min(1).default('olbun'),
  S3_SECRET_KEY: z.string().min(1).default('olbun-desarrollo'),
});

const serverSchemaValidado = serverSchema
  .refine((env) => Boolean(env.GOOGLE_CLIENT_ID) === Boolean(env.GOOGLE_CLIENT_SECRET), {
    message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set together, or neither',
    path: ['GOOGLE_CLIENT_ID'],
  })
  .refine((env) => env.MAIL_TRANSPORT !== 'smtp' || Boolean(env.SMTP_URL), {
    message: 'SMTP_URL is required when MAIL_TRANSPORT is smtp',
    path: ['SMTP_URL'],
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
  const parsed = serverSchemaValidado.safeParse(source);

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
