import 'server-only';

import type { Role } from '@prisma/client';

import { identityClientBecause } from '@/lib/db/tenant';
import { sembrarPlantillasDelSistema } from './plantillas';
import { sembrarConfiguracionRiesgos } from './configuracion-riesgos';
import { sembrarTiposDocumento } from './documentos';
import { sembrarTiposCertificacion } from './personal/certificaciones';
import { uniqueSlug } from '@/lib/domain/slug';
import { logger } from '@/lib/logger';

/**
 * Getting a newly signed-in person into an organisation.
 *
 * Password sign-up creates the person and their organisation together, so it
 * never needs any of this. Google and magic links do not: they authenticate
 * somebody who may belong to nothing at all, and without a landing flow that
 * person is left signed in with every organisation URL answering 404 — the
 * worst kind of dead end, because it looks like the product is broken.
 *
 * Everything here runs on the identity plane. A person exists before any
 * organisation does, so these queries cannot be tenant-scoped; each one filters
 * by user id explicitly instead.
 */

export interface OrganizacionDelUsuario {
  slug: string;
  name: string;
  role: Role;
}

export interface InvitacionRecibida {
  membershipId: string;
  organisationName: string;
  organisationSlug: string;
  role: Role;
  invitadoPor: string | null;
  caducaEn: Date | null;
}

export interface SituacionUsuario {
  /** Organisations they can already enter. */
  organizaciones: OrganizacionDelUsuario[];
  /** Invitations addressed to them and still valid. */
  invitaciones: InvitacionRecibida[];
}

export async function situacionDe(userId: string): Promise<SituacionUsuario> {
  const db = identityClientBecause(
    'the landing flow spans every organisation a person may join',
  );

  const memberships = await db.membership.findMany({
    where: {
      userId,
      deletedAt: null,
      status: { in: ['ACTIVE', 'INVITED'] },
      organisation: { deletedAt: null, isActive: true },
    },
    select: {
      id: true,
      role: true,
      status: true,
      invitationExpiresAt: true,
      invitedBy: { select: { name: true } },
      organisation: { select: { name: true, slug: true } },
    },
    orderBy: { organisation: { name: 'asc' } },
  });

  const ahora = new Date();

  return {
    organizaciones: memberships
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => ({
        slug: m.organisation.slug,
        name: m.organisation.name,
        role: m.role,
      })),
    invitaciones: memberships
      .filter(
        (m) =>
          m.status === 'INVITED' &&
          // An expired invitation is not an offer; showing it would just
          // produce a button that fails.
          (m.invitationExpiresAt === null || m.invitationExpiresAt > ahora),
      )
      .map((m) => ({
        membershipId: m.id,
        organisationName: m.organisation.name,
        organisationSlug: m.organisation.slug,
        role: m.role,
        invitadoPor: m.invitedBy?.name ?? null,
        caducaEn: m.invitationExpiresAt,
      })),
  };
}

export type AceptarResult =
  { ok: true; organisationSlug: string } | { ok: false; error: 'NO_DISPONIBLE' };

/**
 * Accepts an invitation for someone who is already signed in.
 *
 * No token is involved, and that is not a weakening: the token exists to prove
 * you control the invited mailbox, and being authenticated as the invited user
 * is strictly stronger evidence. The membership row is matched on the user id
 * as well as its own, so a guessed id cannot accept somebody else's invitation.
 */
export async function aceptarInvitacionPendiente(
  userId: string,
  membershipId: string,
): Promise<AceptarResult> {
  const db = identityClientBecause('accepting an invitation crosses into a new organisation');

  const membership = await db.membership.findFirst({
    where: {
      id: membershipId,
      userId,
      status: 'INVITED',
      deletedAt: null,
      OR: [{ invitationExpiresAt: null }, { invitationExpiresAt: { gt: new Date() } }],
      organisation: { deletedAt: null, isActive: true },
    },
    select: { id: true, organisation: { select: { slug: true } } },
  });

  if (!membership) return { ok: false, error: 'NO_DISPONIBLE' };

  await db.membership.update({
    where: { id: membership.id },
    data: {
      status: 'ACTIVE',
      acceptedAt: new Date(),
      // Cleared in the same write that activates it, so the emailed link
      // cannot be replayed afterwards.
      invitationTokenHash: null,
      invitationExpiresAt: null,
    },
  });

  logger.info({ userId, membershipId }, 'Invitación aceptada desde la incorporación');

  return { ok: true, organisationSlug: membership.organisation.slug };
}

export type CrearOrganizacionResult =
  { ok: true; organisationSlug: string } | { ok: false; error: 'NOMBRE_INVALIDO' };

/**
 * Creates an organisation for someone who already has an account.
 *
 * The password sign-up path builds the person and the organisation in one
 * transaction; this is the same ending for a person who arrived through a
 * provider instead. It also takes their real name, because a magic-link
 * account was created with a placeholder derived from their address.
 */
export async function crearOrganizacionPara(
  userId: string,
  datos: { empresa: string; nombre?: string | undefined },
): Promise<CrearOrganizacionResult> {
  const empresa = datos.empresa.trim();
  if (empresa.length < 2) return { ok: false, error: 'NOMBRE_INVALIDO' };

  const db = identityClientBecause('creating an organisation happens outside any tenant scope');

  const ocupados = new Set(
    (await db.organisation.findMany({ select: { slug: true } })).map((o) => o.slug),
  );
  const slug = uniqueSlug(empresa, ocupados);

  await db.$transaction(async (tx) => {
    const organisation = await tx.organisation.create({ data: { name: empresa, slug } });

    await tx.membership.create({
      data: {
        userId,
        organisationId: organisation.id,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });

    await sembrarPlantillasDelSistema(tx, organisation.id);
    await sembrarTiposDocumento(tx, organisation.id);
    await sembrarConfiguracionRiesgos(tx, organisation.id);
    await sembrarTiposCertificacion(tx, organisation.id, userId);

    const nombre = datos.nombre?.trim();
    if (nombre) {
      await tx.user.update({ where: { id: userId }, data: { name: nombre } });
    }
  });

  logger.info({ userId, slug }, 'Organización creada desde la incorporación');

  return { ok: true, organisationSlug: slug };
}
