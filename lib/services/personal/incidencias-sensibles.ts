import 'server-only';

import type { Prisma } from '@prisma/client';

import { cifrarObjeto } from '@/lib/crypto/datos-personales';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';

export interface PersonasImplicadasProtegidas {
  texto: string;
}

export async function guardarPersonasImplicadas(
  db: TenantTransactionClient,
  incidenciaId: string,
  texto: string,
): Promise<{ id: string; referencia: string }> {
  const incidencia = await db.incidencia.findFirst({
    where: { id: incidenciaId, deletedAt: null },
    select: { id: true, referencia: true },
  });
  if (!incidencia) {
    throw new ErrorDeCampo('incidenciaId', 'Esa incidencia ya no existe.');
  }

  const sobre = {
    version: 1,
    cifrado: cifrarObjeto({ texto } satisfies PersonasImplicadasProtegidas),
  } satisfies Prisma.InputJsonObject;

  return db.incidencia.update({
    where: { id: incidencia.id },
    data: { personasImplicadas: sobre },
    select: { id: true, referencia: true },
  });
}
