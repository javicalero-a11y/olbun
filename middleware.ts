import NextAuth from 'next-auth';

import { authConfig } from './auth.config';

/**
 * Route protection. Uses only the edge-safe half of the Auth.js config —
 * Prisma and argon2 cannot load in the edge runtime, so the middleware checks
 * for a valid session and nothing more. Authorisation proper happens in the
 * route, where the membership and the permission matrix are available.
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    // Everything except Next internals and static assets.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
export default middleware;
