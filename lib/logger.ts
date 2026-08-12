import 'server-only';

import pino from 'pino';
import pretty from 'pino-pretty';

import { serverEnv } from './env';

/**
 * Structured logging (SPEC §3 Observability). Request, tenant and user
 * correlation IDs are attached by `logger.child({ requestId, organisationId,
 * userId })` at the request boundary — wired up in M1 alongside the session.
 *
 * Pretty output in development goes through pino-pretty as a **stream**, not
 * as a `transport`. A transport runs in a worker thread, and Next cannot
 * resolve that worker's entry point out of its own bundle: every call then
 * threw "the worker has exited" and took the log line with it. That failure
 * was invisible in ordinary use and very visible where it mattered — the
 * console mail transport, which is how invitation and sign-in links are
 * delivered locally, so those links silently never appeared.
 */
const opciones = {
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
};

export const logger =
  serverEnv().NODE_ENV === 'development'
    ? pino(opciones, pretty({ colorize: true }))
    : pino(opciones);

export type Logger = typeof logger;
