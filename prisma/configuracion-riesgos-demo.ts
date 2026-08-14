import type { PrismaClient } from '@prisma/client';

import { CATEGORIAS_RIESGO_POR_DEFECTO } from '../lib/domain/riesgos/categorias';
import { BANDAS_POR_DEFECTO } from '../lib/domain/riesgos/matriz';

/** Keeps the demo idempotent while returning the stable IDs needed by risks. */
export async function sembrarConfiguracionRiesgoDemo(
  prisma: PrismaClient,
  organisationId: string,
  actorId: string,
): Promise<Map<string, string>> {
  for (const [orden, banda] of BANDAS_POR_DEFECTO.entries()) {
    await prisma.bandaRiesgo.upsert({
      where: { organisationId_nivel: { organisationId, nivel: banda.nivel } },
      update: {
        nombre: banda.nombre,
        puntuacionMinima: banda.desde,
        puntuacionMaxima: banda.hasta,
        color: banda.color,
        orden: orden + 1,
        deletedAt: null,
      },
      create: {
        organisationId,
        nivel: banda.nivel,
        nombre: banda.nombre,
        puntuacionMinima: banda.desde,
        puntuacionMaxima: banda.hasta,
        color: banda.color,
        orden: orden + 1,
        createdById: actorId,
      },
    });
  }

  const categorias = new Map<string, string>();
  for (const [orden, categoria] of CATEGORIAS_RIESGO_POR_DEFECTO.entries()) {
    const registro = await prisma.categoriaRiesgo.upsert({
      where: { organisationId_clave: { organisationId, clave: categoria.clave } },
      update: {
        nombre: categoria.nombre,
        color: categoria.color,
        orden: orden + 1,
        isActive: true,
        deletedAt: null,
      },
      create: {
        organisationId,
        clave: categoria.clave,
        nombre: categoria.nombre,
        color: categoria.color,
        orden: orden + 1,
        createdById: actorId,
      },
      select: { id: true },
    });
    categorias.set(categoria.clave, registro.id);
  }

  return categorias;
}
