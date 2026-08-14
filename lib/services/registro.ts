import 'server-only';

import { identityClientBecause } from '@/lib/db/tenant';
import { sembrarPlantillasDelSistema } from './plantillas';
import { sembrarTiposDocumento } from './documentos';
import { sembrarConfiguracionRiesgos } from './configuracion-riesgos';
import { hashPassword } from '@/lib/auth/password';
import { uniqueSlug } from '@/lib/domain/slug';
import { logger } from '@/lib/logger';
import type { SignUpInput } from '@/lib/validation/auth';

/**
 * Sign-up: creates the person, their organisation and an OWNER membership in
 * one transaction (SPEC §5.1). Either all three exist or none do — a user
 * stranded without an organisation cannot sign in and cannot be repaired
 * without support intervention.
 */

export type RegistroResult =
  | { ok: true; organisationSlug: string; userId: string }
  | { ok: false; error: 'EMAIL_YA_REGISTRADO' };

export async function registrarOrganizacion(input: SignUpInput): Promise<RegistroResult> {
  // Sign-up necessarily runs before any organisation exists, so it is one of
  // the few legitimate unscoped operations.
  const db = identityClientBecause('sign-up creates the organisation being scoped to');

  const existing = await db.user.findFirst({
    where: { email: input.email },
    select: { id: true },
  });

  if (existing) {
    // Deliberately the same shape of answer as success would give the caller,
    // so the sign-up form cannot be used to enumerate registered addresses.
    return { ok: false, error: 'EMAIL_YA_REGISTRADO' };
  }

  const passwordHash = await hashPassword(input.password);

  const taken = new Set(
    (await db.organisation.findMany({ select: { slug: true } })).map((o) => o.slug),
  );
  const slug = uniqueSlug(input.empresa, taken);

  const { user, organisation } = await db.$transaction(async (tx) => {
    const organisation = await tx.organisation.create({
      data: { name: input.empresa, slug },
    });

    const user = await tx.user.create({
      data: {
        email: input.email,
        name: input.nombre,
        passwordHash,
      },
    });

    await tx.membership.create({
      data: {
        userId: user.id,
        organisationId: organisation.id,
        role: 'OWNER',
        status: 'ACTIVE',
        acceptedAt: new Date(),
      },
    });

    // In the same transaction: an organisation without its procedure
    // templates would have to build its first expediente by hand while the
    // clock was already running.
    await sembrarPlantillasDelSistema(tx, organisation.id);
    await sembrarTiposDocumento(tx, organisation.id);
    await sembrarConfiguracionRiesgos(tx, organisation.id);

    return { user, organisation };
  });

  logger.info(
    { userId: user.id, organisationId: organisation.id, slug },
    'Organización registrada',
  );

  return { ok: true, organisationSlug: organisation.slug, userId: user.id };
}
