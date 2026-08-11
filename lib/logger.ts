import 'server-only';

import pino from 'pino';

import { serverEnv } from './env';

/**
 * Structured logging (SPEC §3 Observability). Request, tenant and user
 * correlation IDs are attached by `logger.child({ requestId, organisationId,
 * userId })` at the request boundary — wired up in M1 alongside the session.
 */
export const logger = pino({
  level: serverEnv().LOG_LEVEL,
  redact: {
    paths: [
      'password',
      'passwordHash',
      'mfaSecret',
      'token',
      'req.headers.authorization',
      'req.headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  ...(serverEnv().NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
    : {}),
});

export type Logger = typeof logger;
