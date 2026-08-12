import 'server-only';

import type { Prisma } from '@prisma/client';

import { PLANTILLAS_SEMILLA } from '@/lib/domain/expedientes/plantillas-semilla';

/**
 * Gives a brand-new organisation the procedure templates it starts with.
 *
 * Without these, a tenant's first expediente would have to be assembled hito
 * by hito while the clock is already running — which is exactly the situation
 * the product exists to prevent. They are starting points, not authority: the
 * tenant owns them from the moment they edit one, and every deadline in them
 * is pending the legal review in `docs/revision-juridica-plazos.md`.
 */
export async function sembrarPlantillasDelSistema(
  db: Prisma.TransactionClient,
  organisationId: string,
): Promise<number> {
  let creadas = 0;

  for (const semilla of PLANTILLAS_SEMILLA) {
    const plantilla = await db.plantillaProcedimiento.create({
      data: {
        organisationId,
        nombre: semilla.nombre,
        tipo: semilla.tipo as never,
        jurisdiccion: semilla.jurisdiccion as never,
        descripcion: semilla.descripcion,
        esDelSistema: true,
      },
      select: { id: true },
    });

    for (const hito of semilla.hitos) {
      await db.plantillaHito.create({
        data: {
          organisationId,
          plantillaId: plantilla.id,
          orden: hito.orden,
          nombre: hito.nombre,
          tipo: hito.tipo,
          descripcion: hito.descripcion ?? null,
          plazoCantidad: hito.plazoCantidad ?? null,
          plazoComputo: (hito.plazoComputo ?? null) as never,
          plazoFundamento: hito.plazoFundamento ?? null,
          plazoEsPreclusivo: hito.plazoEsPreclusivo ?? false,
          desplazamientoDias: hito.desplazamientoDias ?? null,
        },
      });
    }

    creadas += 1;
  }

  return creadas;
}
