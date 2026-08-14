import 'server-only';

import { prismaElevated } from './prisma';

/**
 * Resolves the tenant named by a public forwarding address.
 *
 * This is necessarily cross-tenant: the inbound provider knows an alias but
 * not an organisation id. Keep it in `lib/db`, return the minimum fields, and
 * call it only after the webhook secret has been verified. Every subsequent
 * operation switches immediately to the RLS-constrained tenant client.
 */
export async function resolverAliasEntrada(direccion: string) {
  return prismaElevated.buzonConectado.findFirst({
    where: {
      direccion: { equals: direccion.trim(), mode: 'insensitive' },
      tipo: 'ALIAS_REENVIO',
      activo: true,
      deletedAt: null,
    },
    select: { id: true, organisationId: true, contratoId: true, direccion: true },
  });
}
