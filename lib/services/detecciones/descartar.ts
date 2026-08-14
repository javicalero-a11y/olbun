import 'server-only';

import type { TenantTransactionClient } from '@/lib/db/tenant';

/** Records a human discard so later machine analyses cannot resurrect it. */
export async function descartarDeteccion(
  db: TenantTransactionClient,
  datos: { deteccionId: string; revisorId: string; motivo: string },
): Promise<{ tipo: string }> {
  const deteccion = await db.deteccion.findFirst({
    where: { id: datos.deteccionId, deletedAt: null },
    select: { id: true, tipo: true, estado: true },
  });

  if (!deteccion) throw new Error('La detección no existe.');
  if (deteccion.estado === 'CONVERTIDA') {
    throw new Error('No se puede descartar una detección ya convertida en expediente.');
  }

  await db.deteccion.update({
    where: { id: deteccion.id },
    data: {
      estado: 'DESCARTADA',
      // The reviewer id is what makes later analyses leave this decision
      // alone. An automatic discard has no reviewer.
      revisadaPorId: datos.revisorId,
      revisadaEn: new Date(),
      motivoDescarte: datos.motivo,
    },
  });

  return { tipo: deteccion.tipo };
}
