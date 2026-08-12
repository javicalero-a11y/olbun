import 'server-only';

import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import Nodemailer from 'next-auth/providers/nodemailer';
import type { Provider } from 'next-auth/providers';

import { correoEnlaceAcceso } from '@/lib/mail/plantillas';
import { mailService } from '@/lib/mail';
import { serverEnv } from '@/lib/env';

/**
 * The providers that are not the password form.
 *
 * Google is only registered when both halves of its credential are present, so
 * a developer without a Google Cloud project gets a working app that simply
 * does not offer the button — rather than one that boots and then fails the
 * moment somebody clicks it.
 *
 * The magic link goes through this product's own mail interface instead of
 * Auth.js's SMTP transport. That means the dev console transport prints the
 * link, so the whole flow is testable with no SMTP server anywhere, and the
 * message looks like every other mail Olbun sends.
 */

/** How long a magic link stays valid. Short: it is a bearer credential. */
export const MINUTOS_ENLACE_ACCESO = 15;

export function proveedoresAdicionales(): Provider[] {
  const env = serverEnv();
  const proveedores: Provider[] = [];

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    proveedores.push(
      Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Never link by matching addresses alone. Whether an account may be
        // linked is decided in lib/auth/politica-acceso, which insists the
        // provider states it verified the address.
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }

  if (env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET) {
    proveedores.push(
      MicrosoftEntraID({
        clientId: env.MICROSOFT_CLIENT_ID,
        clientSecret: env.MICROSOFT_CLIENT_SECRET,
        // Without a tenant the provider defaults to `common`, which lets any
        // Entra directory sign in. That is what a product sold to many
        // different companies wants; set MICROSOFT_TENANT_ID to lock it to one.
        ...(env.MICROSOFT_TENANT_ID ? { issuer: env.MICROSOFT_TENANT_ID } : {}),
        // Same rule as Google: linking is decided by the policy, which for
        // Entra reads the directory the token came from (see
        // lib/auth/politica-acceso.correoVerificadoPor).
        allowDangerousEmailAccountLinking: false,
      }),
    );
  }

  proveedores.push(
    Nodemailer({
      // Required by the provider's type but unused: sendVerificationRequest
      // below replaces the transport entirely.
      server: { host: 'localhost', port: 25 },
      from: env.AUTH_EMAIL_FROM ?? 'no-reply@olbun.es',
      maxAge: MINUTOS_ENLACE_ACCESO * 60,

      async sendVerificationRequest({ identifier, url }) {
        await mailService().enviar(
          correoEnlaceAcceso({
            para: identifier,
            url,
            minutosCaducidad: MINUTOS_ENLACE_ACCESO,
          }),
        );
      },
    }),
  );

  return proveedores;
}

/** True when the Google button should be rendered. */
export function googleDisponible(): boolean {
  const env = serverEnv();
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export type EstadoGoogle = 'activo' | 'sin-configurar' | 'oculto';

/**
 * What the sign-in page should do about the Google button.
 *
 * In production an unconfigured provider is simply absent — a button that
 * fails when pressed is worse than no button. In development it is shown
 * disabled instead, so the sign-in page can be reviewed as it will really look
 * without anyone having to create a Google Cloud project first.
 */
export function estadoGoogle(): EstadoGoogle {
  if (googleDisponible()) return 'activo';
  return serverEnv().NODE_ENV === 'development' ? 'sin-configurar' : 'oculto';
}

/** True when the Microsoft button should be rendered. */
export function microsoftDisponible(): boolean {
  const env = serverEnv();
  return Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET);
}

export function estadoMicrosoft(): EstadoGoogle {
  if (microsoftDisponible()) return 'activo';
  return serverEnv().NODE_ENV === 'development' ? 'sin-configurar' : 'oculto';
}
