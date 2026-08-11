import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe half of the Auth.js configuration.
 *
 * Middleware runs on the edge runtime, where neither Prisma nor argon2 (a
 * native module) can load. Everything that touches the database lives in
 * ./auth.ts; this file holds only what the middleware needs to decide whether a
 * request may proceed.
 */
export const authConfig = {
  // Auth.js refuses unrecognised hosts unless told otherwise. We run behind our
  // own origin (port 3100 locally, a known domain in production), and APP_URL is
  // validated at boot, so the host is ours by construction.
  trustHost: true,
  pages: {
    signIn: '/acceso',
    error: '/acceso',
  },
  session: {
    strategy: 'jwt',
    // SPEC §7.4: 8-hour idle timeout. The absolute 30-day cap is enforced in
    // the jwt callback in ./auth.ts, which has the issue time.
    maxAge: 8 * 60 * 60,
    updateAge: 15 * 60,
  },
  callbacks: {
    authorized({ auth, request }) {
      const isSignedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      const isPublic =
        pathname === '/' ||
        pathname.startsWith('/acceso') ||
        pathname.startsWith('/registro') ||
        pathname.startsWith('/api/auth') ||
        pathname.startsWith('/api/health');

      if (isPublic) return true;

      return isSignedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
