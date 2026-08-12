import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

import { authConfig } from './auth.config';
import { olbunAdapter } from '@/lib/auth/adaptador';
import { proveedoresAdicionales } from '@/lib/auth/proveedores';
import { estadoParaPolitica } from '@/lib/services/acceso';
import {
  correoVerificadoPor,
  decidirAcceso,
  type ProveedorAcceso,
} from '@/lib/auth/politica-acceso';
import { verificarCredenciales } from '@/lib/services/acceso';
import { signInSchema } from '@/lib/validation/auth';

/**
 * Auth.js v5. Credentials require the JWT session strategy — the database
 * session strategy is not supported for them — so the token carries the user
 * id and nothing else. The *organisation* is deliberately not in the token:
 * it comes from the URL and is re-checked against the membership table on
 * every request (see lib/auth/session.ts), so a stale token can never widen
 * access.
 *
 * The adapter is still needed under the JWT strategy: Google and magic-link
 * sign-ins have to persist a user and an account row even though the session
 * itself never touches the database. The `sessions` table stays unused.
 *
 * All credential logic lives in lib/services/acceso.ts, shared with the sign-in
 * server action so the lockout counter and the MFA rules cannot drift between
 * the two paths.
 */

/** Absolute session lifetime, regardless of activity (SPEC §7.4). */
const ABSOLUTE_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: olbunAdapter(),
  providers: [
    ...proveedoresAdicionales(),
    Credentials({
      credentials: {
        email: { label: 'Correo electrónico', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
        codigo: { label: 'Código de verificación', type: 'text' },
      },
      async authorize(credentials) {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const bruto = credentials['codigo'];
        const codigo = typeof bruto === 'string' && bruto.length > 0 ? bruto : undefined;

        const resultado = await verificarCredenciales(
          parsed.data.email,
          parsed.data.password,
          codigo,
        );

        if (resultado.estado !== 'OK') return null;

        return { id: resultado.userId, email: resultado.email, name: resultado.nombre };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    /**
     * The gate for every route that is not the password form.
     *
     * Credentials already did its own checking in `authorize`, so it passes
     * straight through. Google and magic links go through the policy in
     * lib/auth/politica-acceso, which decides whether this address may be
     * linked and refuses to let an account with MFA skip its second factor.
     *
     * Returning a string sends the person to the sign-in page with a code the
     * page turns into a sentence; returning false would give them Auth.js's
     * generic error instead.
     */
    async signIn({ user, account, profile }) {
      if (!account || account.provider === 'credentials') return true;

      const proveedor: ProveedorAcceso = account.type === 'email' ? 'email' : 'oauth';
      const email = user.email ?? (typeof profile?.email === 'string' ? profile.email : null);
      if (!email) return '/acceso?motivo=CORREO_NO_VERIFICADO';

      const estado = await estadoParaPolitica(email, account.provider);

      const decision = decidirAcceso({
        proveedor,
        // Each provider states this differently — Google with `email_verified`,
        // Entra not at all — so the reading lives in one tested function rather
        // than inline here.
        correoVerificadoPorProveedor: correoVerificadoPor(account.provider, profile),
        existente: estado,
      });

      return decision.permitido ? true : `/acceso?motivo=${decision.motivo}`;
    },

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
