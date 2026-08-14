import 'server-only';

import { prismaElevated } from './prisma';

/** Minimal identity-plane lookup: the callback has a state but no tenant id. */
export async function resolverSolicitudOAuth(stateHash: string) {
  return prismaElevated.solicitudOAuthBuzon.findUnique({
    where: { stateHash },
    select: {
      id: true,
      organisationId: true,
      proveedor: true,
      solicitadoPorId: true,
      pkceVerifierCifrado: true,
      contratoId: true,
      esPersonal: true,
      politicaInternaDocumentoId: true,
      consultaRepresentacionFecha: true,
      historicoDesde: true,
      expiresAt: true,
      consumedAt: true,
      organisation: { select: { slug: true } },
    },
  });
}
