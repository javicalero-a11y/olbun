import 'server-only';

import type { Prisma } from '@prisma/client';

import { ErrorDeCampo } from '@/lib/services/error-de-campo';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { CATEGORIAS_RIESGO_POR_DEFECTO } from '@/lib/domain/riesgos/categorias';
import {
  BANDAS_POR_DEFECTO,
  sonBandasValidas,
  type BandaMatriz,
} from '@/lib/domain/riesgos/matriz';

/** Gives every new tenant an editable, internally consistent 5x5 matrix. */
export async function sembrarBandasRiesgo(
  db: Prisma.TransactionClient,
  organisationId: string,
): Promise<number> {
  for (const [indice, banda] of BANDAS_POR_DEFECTO.entries()) {
    await db.bandaRiesgo.create({
      data: {
        organisationId,
        nivel: banda.nivel,
        nombre: banda.nombre,
        puntuacionMinima: banda.desde,
        puntuacionMaxima: banda.hasta,
        color: banda.color,
        orden: indice + 1,
      },
    });
  }
  return BANDAS_POR_DEFECTO.length;
}

export async function sembrarCategoriasRiesgo(
  db: Prisma.TransactionClient,
  organisationId: string,
): Promise<number> {
  for (const [indice, categoria] of CATEGORIAS_RIESGO_POR_DEFECTO.entries()) {
    await db.categoriaRiesgo.create({
      data: {
        organisationId,
        clave: categoria.clave,
        nombre: categoria.nombre,
        color: categoria.color,
        orden: indice + 1,
      },
    });
  }
  return CATEGORIAS_RIESGO_POR_DEFECTO.length;
}

export async function sembrarConfiguracionRiesgos(
  db: Prisma.TransactionClient,
  organisationId: string,
): Promise<void> {
  await sembrarBandasRiesgo(db, organisationId);
  await sembrarCategoriasRiesgo(db, organisationId);
}

export async function crearCategoriaRiesgo(
  db: TenantTransactionClient,
  organisationId: string,
  datos: { clave: string; nombre: string; color: string; actorId: string },
): Promise<{ id: string; nombre: string }> {
  const repetida = await db.categoriaRiesgo.findFirst({
    where: { OR: [{ clave: datos.clave }, { nombre: datos.nombre }] },
    select: { id: true },
  });
  if (repetida) {
    throw new ErrorDeCampo('nombre', 'Ya existe una categoría con esa clave o ese nombre.');
  }
  const maxima = await db.categoriaRiesgo.aggregate({ _max: { orden: true } });
  return db.categoriaRiesgo.create({
    data: {
      organisationId,
      clave: datos.clave,
      nombre: datos.nombre,
      color: datos.color,
      orden: (maxima._max.orden ?? 0) + 1,
      createdById: datos.actorId,
    },
    select: { id: true, nombre: true },
  });
}

export async function actualizarCategoriaRiesgo(
  db: TenantTransactionClient,
  datos: { categoriaId: string; nombre: string; color: string; isActive: boolean },
): Promise<{ id: string; nombre: string; isActive: boolean }> {
  const categoria = await db.categoriaRiesgo.findFirst({
    where: { id: datos.categoriaId, deletedAt: null },
    select: { id: true },
  });
  if (!categoria) throw new ErrorDeCampo('categoriaId', 'Esa categoría ya no existe.');
  const nombreUsado = await db.categoriaRiesgo.findFirst({
    where: { nombre: datos.nombre, id: { not: categoria.id }, deletedAt: null },
    select: { id: true },
  });
  if (nombreUsado) throw new ErrorDeCampo('nombre', 'Ese nombre ya está en uso.');

  return db.categoriaRiesgo.update({
    where: { id: categoria.id },
    data: { nombre: datos.nombre, color: datos.color, isActive: datos.isActive },
    select: { id: true, nombre: true, isActive: true },
  });
}

export async function actualizarBandasRiesgo(
  db: TenantTransactionClient,
  bandas: readonly BandaMatriz[],
): Promise<number> {
  if (!sonBandasValidas(bandas)) {
    throw new ErrorDeCampo('altoHasta', 'La matriz debe cubrir del 1 al 25 sin huecos.');
  }
  const existentes = await db.bandaRiesgo.findMany({
    where: { deletedAt: null },
    select: { id: true, nivel: true },
  });
  if (existentes.length !== 4) {
    throw new ErrorDeCampo('altoHasta', 'La matriz debe conservar sus cuatro niveles.');
  }
  for (const [orden, banda] of bandas.entries()) {
    const existente = existentes.find((fila) => fila.nivel === banda.nivel);
    if (!existente) throw new ErrorDeCampo('altoHasta', 'Falta un nivel de la matriz.');
    await db.bandaRiesgo.update({
      where: { id: existente.id },
      data: {
        nombre: banda.nombre,
        color: banda.color,
        puntuacionMinima: banda.desde,
        puntuacionMaxima: banda.hasta,
        orden: orden + 1,
      },
    });
  }
  return bandas.length;
}
