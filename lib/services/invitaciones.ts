import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import type { Role } from '@prisma/client';

import { identityClientBecause } from '@/lib/db/tenant';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { mailService } from '@/lib/mail';
import { correoInvitacion } from '@/lib/mail/plantillas';

/**
 * Invitations (SPEC §5.1): a signed, single-use, 7-day token. Accepting as an
 * existing user adds a membership rather than creating a second account.
 *
 * Only the SHA-256 of the token is stored. A leaked database therefore yields
 * no usable invitation links, and the raw token exists only in the email.
 */

export const DIAS_CADUCIDAD_INVITACION = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type CrearInvitacionResult =
  | {
      ok: true;
      /**
       * The single-use link. Returned so an administrator can pass it on by
       * hand when delivery fails — the invitation is valid either way.
       */
      url: string;
      correoEnviado: boolean;
    }
  | { ok: false; error: 'YA_ES_MIEMBRO' | 'YA_INVITADO' };

export async function crearInvitacion(datos: {
  organisationId: string;
  organisationName: string;
  email: string;
  role: Role;
  invitadoPorId: string;
  invitadoPorNombre: string;
}): Promise<CrearInvitacionResult> {
  const db = identityClientBecause('inviting may target a person who has no account yet');

  const usuario = await db.user.findFirst({
    where: { email: datos.email, deletedAt: null },
    select: { id: true },
  });

  if (usuario) {
    const existente = await db.membership.findFirst({
      where: { userId: usuario.id, organisationId: datos.organisationId, deletedAt: null },
      select: { status: true },
    });

    if (existente?.status === 'ACTIVE') return { ok: false, error: 'YA_ES_MIEMBRO' };
    if (existente?.status === 'INVITED') return { ok: false, error: 'YA_INVITADO' };
  }

  const token = randomBytes(32).toString('base64url');
  const expira = new Date(Date.now() + DIAS_CADUCIDAD_INVITACION * 24 * 60 * 60 * 1000);

  // A person invited before they have an account gets a placeholder user row,
  // so the membership can exist and the invitation can be tracked. The row
  // carries no password and cannot be signed into until the invite is accepted.
  const destinatario =
    usuario ??
    (await db.user.create({
      data: { email: datos.email, name: datos.email.split('@')[0] ?? datos.email },
      select: { id: true },
    }));

  await db.membership.upsert({
    where: {
      userId_organisationId: {
        userId: destinatario.id,
        organisationId: datos.organisationId,
      },
    },
    update: {
      role: datos.role,
      status: 'INVITED',
      invitationTokenHash: hashToken(token),
      invitationExpiresAt: expira,
      invitedById: datos.invitadoPorId,
      invitedAt: new Date(),
      deletedAt: null,
    },
    create: {
      userId: destinatario.id,
      organisationId: datos.organisationId,
      role: datos.role,
      status: 'INVITED',
      invitationTokenHash: hashToken(token),
      invitationExpiresAt: expira,
      invitedById: datos.invitadoPorId,
      invitedAt: new Date(),
    },
  });

  const url = `${serverEnv().APP_URL}/invitacion/${token}`;

  // The invitation row is already committed, so a mail failure must not
  // discard it: report the failure and hand the link back instead. Throwing
  // here would leave a valid, unreachable invitation behind and show the
  // administrator an error that suggests nothing happened.
  let correoEnviado = true;

  try {
    await mailService().enviar(
      correoInvitacion({
        para: datos.email,
        organizacion: datos.organisationName,
        invitadoPor: datos.invitadoPorNombre,
        url,
        diasCaducidad: DIAS_CADUCIDAD_INVITACION,
      }),
    );
  } catch (error) {
    correoEnviado = false;
    logger.error(
      { err: error, organisationId: datos.organisationId },
      'La invitación se ha creado pero no se ha podido enviar el correo',
    );
  }

  logger.info({ organisationId: datos.organisationId, role: datos.role }, 'Invitación creada');

  return { ok: true, url, correoEnviado };
}

export interface InvitacionPendiente {
  organisationName: string;
  organisationSlug: string;
  email: string;
  role: Role;
  necesitaContrasena: boolean;
}

/** Resolves a raw token without consuming it, for rendering the accept page. */
export async function leerInvitacion(token: string): Promise<InvitacionPendiente | null> {
  const db = identityClientBecause('an invitation is resolved before any session exists');

  const membership = await db.membership.findFirst({
    where: {
      invitationTokenHash: hashToken(token),
      status: 'INVITED',
      deletedAt: null,
      invitationExpiresAt: { gt: new Date() },
    },
    select: {
      role: true,
      user: { select: { email: true, passwordHash: true } },
      organisation: { select: { name: true, slug: true } },
    },
  });

  if (!membership) return null;

  return {
    organisationName: membership.organisation.name,
    organisationSlug: membership.organisation.slug,
    email: membership.user.email,
    role: membership.role,
    necesitaContrasena: membership.user.passwordHash === null,
  };
}

export type AceptarInvitacionResult =
  | { ok: true; organisationSlug: string; email: string }
  | { ok: false; error: 'INVALIDA_O_CADUCADA' };

/**
 * Consumes the invitation. The token is cleared in the same update that
 * activates the membership, so a replayed link finds nothing — the single-use
 * guarantee is the database's, not the application's.
 */
export async function aceptarInvitacion(
  token: string,
  passwordHash: string | null,
): Promise<AceptarInvitacionResult> {
  const db = identityClientBecause('accepting an invitation happens before a session exists');

  const membership = await db.membership.findFirst({
    where: {
      invitationTokenHash: hashToken(token),
      status: 'INVITED',
      deletedAt: null,
      invitationExpiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userId: true,
      user: { select: { email: true, passwordHash: true } },
      organisation: { select: { slug: true } },
    },
  });

  if (!membership) return { ok: false, error: 'INVALIDA_O_CADUCADA' };

  await db.$transaction(async (tx) => {
    await tx.membership.update({
      where: { id: membership.id },
      data: {
        status: 'ACTIVE',
        acceptedAt: new Date(),
        invitationTokenHash: null,
        invitationExpiresAt: null,
      },
    });

    if (passwordHash && membership.user.passwordHash === null) {
      await tx.user.update({
        where: { id: membership.userId },
        data: { passwordHash, emailVerifiedAt: new Date() },
      });
    }
  });

  return {
    ok: true,
    organisationSlug: membership.organisation.slug,
    email: membership.user.email,
  };
}
