import 'server-only';

import { hash, verify } from '@node-rs/argon2';
import { createHash } from 'node:crypto';

import { logger } from '@/lib/logger';

/**
 * Password hashing and policy (SPEC §7.4).
 *
 * argon2id with 64 MB of memory and 3 iterations. The parameters live here
 * rather than at call sites so that raising them later is one edit — and so
 * that nobody hashes a password with defaults by accident.
 */
// The `algorithm` option is deliberately omitted: @node-rs/argon2 exports
// `Algorithm` as an ambient const enum, which `verbatimModuleSyntax` forbids
// importing, and hardcoding its numeric value would silently rot if the
// library reordered it. argon2id is the library's default, and
// password.test.ts asserts that every hash we produce carries the `$argon2id$`
// prefix — so a change of default fails the build rather than weakening
// hashing unnoticed.
const ARGON2_OPTIONS = {
  memoryCost: 65_536, // 64 MiB
  timeCost: 3,
  parallelism: 4,
} as const;

export const MIN_PASSWORD_LENGTH = 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/**
 * Verifies a password. Returns false rather than throwing on a malformed hash,
 * so a corrupted row is a failed login and not a 500 that reveals the problem
 * to whoever is probing.
 */
export async function verifyPassword(hashed: string, password: string): Promise<boolean> {
  try {
    return await verify(hashed, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Checks a password against Have I Been Pwned using k-anonymity: only the first
 * five characters of the SHA-1 hash leave this process, so the password itself
 * is never transmitted.
 *
 * **Fails open.** HIBP being unreachable must not stop someone signing up; the
 * 12-character minimum still applies. A breach lookup is a nice-to-have, not a
 * gate we can afford to make load-bearing.
 */
export async function isPasswordBreached(
  password: string,
  signal?: AbortSignal,
): Promise<boolean> {
  const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: signal ?? AbortSignal.timeout(2500),
    });

    if (!response.ok) return false;

    const body = await response.text();

    return body.split('\n').some((line) => {
      const [candidate, count] = line.trim().split(':');
      return candidate === suffix && count !== '0';
    });
  } catch (error) {
    logger.warn({ err: error }, 'HIBP unreachable; skipping breach check');
    return false;
  }
}
