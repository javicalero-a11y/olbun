import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authConfig } from './auth.config';
import { verifyPassword } from '@/lib/auth/password';
import { identityClientBecause } from '@/lib/db/tenant';
import { logger } from '@/lib/logger';
import { signInSchema } from '@/lib/validation/auth';

/**
 * Auth.js v5. Credentials require the JWT session strategy — the database
 * session strategy is not supported for them — so the token carries the user
 * id and nothing else. The *organisation* is deliberately not in the token:
 * it comes from the URL and is re-checked against the membership table on
 * every request (see lib/auth/session.ts), so a stale token can never widen
 * access.
 */

/** SPEC §7.4: 5 failed attempts per 15 minutes. */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

/** Absolute session lifetime, regardless of activity. */
const ABSOLUTE_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const db = identityClientBecause(
          'sign-in resolves a user before any organisation is known',
        );

        const user = await db.user.findFirst({
          where: { email, deletedAt: null },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            failedLoginCount: true,
            lockedUntil: true,
          },
        });

        // Always spend roughly the same time whether or not the account exists,
        // so response timing does not reveal which addresses are registered.
        if (!user?.passwordHash) {
          await verifyPassword(
            '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHRzb21lc2FsdA$0000000000000000000000000000000000000000000',
            password,
          );
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          logger.warn({ userId: user.id }, 'Intento de acceso sobre cuenta bloqueada');
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, password);

        if (!valid) {
          const failedLoginCount = user.failedLoginCount + 1;
          const lockedUntil =
            failedLoginCount >= MAX_FAILED_ATTEMPTS
              ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
              : null;

          await db.user.update({
            where: { id: user.id },
            data: { failedLoginCount, lockedUntil },
          });

          return null;
        }

        await db.user.update({
          where: { id: user.id },
          data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    jwt({ token, user }) {
      if (user?.id) {
        token['uid'] = user.id;
        token['iat_abs'] = Math.floor(Date.now() / 1000);
      }

      // Absolute lifetime: a session that keeps being refreshed still expires.
      const issuedAt = token['iat_abs'];
      if (
        typeof issuedAt === 'number' &&
        Math.floor(Date.now() / 1000) - issuedAt > ABSOLUTE_SESSION_MAX_AGE_SECONDS
      ) {
        return null;
      }

      return token;
    },

    session({ session, token }) {
      const uid = token['uid'];
      if (typeof uid === 'string') {
        session.user.id = uid;
      }
      return session;
    },
  },
});
