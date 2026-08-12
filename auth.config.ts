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
    // Auth.js's own "check your email" screen is unstyled and in English.
    verifyRequest: '/revisa-tu-correo',
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
        // An invited person has no session by definition — requiring one here
        // would make every invitation impossible to accept. The token in the
        // URL is the credential, and it is validated by the page itself.
        pathname.startsWith('/invitacion/') ||
        pathname.startsWith('/api/auth') ||
        // Reached while signed out, by definition: it is the page telling you
        // to go and click the link that will sign you in.
        pathname.startsWith('/revisa-tu-correo') ||
        pathname.startsWith('/api/health');

      if (isPublic) return true;

      return isSignedIn;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
