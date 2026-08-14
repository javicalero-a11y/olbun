import 'server-only';

import type { Prisma } from '@prisma/client';

import type { TenantTransactionClient } from '@/lib/db/tenant';
import { hoyEn, type FechaCivil } from '@/lib/domain/fecha';
import {
  normalizarBandas,
  valorar,
  type BandaMatriz,
  type Escala,
} from '@/lib/domain/riesgos/matriz';
import { proximaRevisionDesde } from '@/lib/domain/riesgos/ciclo';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';

/**
 * The risk register and the incident log (SPEC §4.6, M10).
 *
 * Two records that look similar and answer opposite questions: an incidencia
 * is something that happened, a riesgo is something that has not. Keeping them
 * apart is what lets the register be reviewed on a cadence while the log stays
 * a chronological record nobody rewrites.
 *
 * Both can escalate into an expediente, and both can be born from a detection
 * a person confirmed — which is the link that makes the triage queue whole.
 */

/**
 * Next reference in a per-organisation, per-year series.
 *
 * Generalised from the expediente numbering: three series that number
 * themselves three slightly different ways is the kind of divergence nobody
 * notices until a customer asks why their incidents skip a number.
 */
export async function siguienteReferenciaDe(
  buscarUltima: (prefijo: string) => Promise<string | null>,
  prefijo: string,
  anio: number,
): Promise<string> {
  const completo = `${prefijo}-${String(anio)}-`;
  const ultima = await buscarUltima(completo);

  const siguiente = ultima ? Number(ultima.slice(completo.length)) + 1 : 1;

  return `${completo}${String(siguiente).padStart(4, '0')}`;
}

function aDate(fecha: FechaCivil): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

export async function cargarBandasRiesgo(
  db: TenantTransactionClient,
): Promise<readonly BandaMatriz[]> {
  const filas = await db.bandaRiesgo.findMany({
    where: { deletedAt: null },
    select: {
      nivel: true,
      nombre: true,
      puntuacionMinima: true,
      puntuacionMaxima: true,
      color: true,
    },
    orderBy: { orden: 'asc' },
  });

  return normalizarBandas(
    filas.map((fila) => ({
      nivel: fila.nivel,
      nombre: fila.nombre,
      desde: fila.puntuacionMinima,
      hasta: fila.puntuacionMaxima,
      color: fila.color,
    })),
  );
}

export async function categoriaRiesgoPorClave(
  db: TenantTransactionClient,
  clave: string,
): Promise<{ id: string; clave: string }> {
  const categoria = await db.categoriaRiesgo.findFirst({
    where: { clave, isActive: true, deletedAt: null },
    select: { id: true, clave: true },
  });
  if (categoria) return categoria;

  const operativa = await db.categoriaRiesgo.findFirst({
    where: { clave: 'OPERATIVO', isActive: true, deletedAt: null },
    select: { id: true, clave: true },
  });
  if (!operativa) {
    throw new ErrorDeCampo(
      'categoriaId',
      'La organización no tiene una categoría de riesgo activa.',
    );
  }
  return operativa;
}

export interface CrearIncidenciaDatos {
  tipo: string;
  gravedad: string;
  fechaHecho: Date;
  descripcion: string;
  contratoId?: string | undefined;
  lugar?: string | undefined;
  medidasInmediatas?: string | undefined;
  esNotificableAAutoridad?: boolean | undefined;
  deteccionId?: string | undefined;
  creadoPorId: string;
}

export async function crearIncidencia(
  db: TenantTransactionClient,
  organisationId: string,
  datos: CrearIncidenciaDatos,
): Promise<{ id: string; referencia: string }> {
  if (datos.contratoId) {
    const contrato = await db.contrato.findFirst({
      where: { id: datos.contratoId, deletedAt: null },
      select: { id: true },
    });
    if (!contrato) throw new ErrorDeCampo('contratoId', 'Ese contrato ya no existe.');
  }
  const referencia = await siguienteReferenciaDe(
    async (prefijo) => {
      const ultima = await db.incidencia.findFirst({
        where: { referencia: { startsWith: prefijo } },
        select: { referencia: true },
        orderBy: { referencia: 'desc' },
      });
      return ultima?.referencia ?? null;
    },
    'INC',
    datos.fechaHecho.getUTCFullYear(),
  );

  return db.incidencia.create({
    data: {
      organisationId,
      referencia,
      tipo: datos.tipo as never,
      gravedad: datos.gravedad as never,
      fechaHecho: datos.fechaHecho,
      // Recorded now because "when were we told" is what a diligence argument
      // turns on, and reconstructing it later is guesswork.
      fechaComunicacion: new Date(),
      descripcion: datos.descripcion,
      contratoId: datos.contratoId ?? null,
      lugar: datos.lugar ?? null,
      medidasInmediatas: datos.medidasInmediatas ?? null,
      esNotificableAAutoridad: datos.esNotificableAAutoridad ?? false,
      deteccionId: datos.deteccionId ?? null,
      createdById: datos.creadoPorId,
    },
    select: { id: true, referencia: true },
  });
}

export interface CrearRiesgoDatos {
  categoriaId: string;
  causa: string;
  evento: string;
  consecuencia: string;
  probabilidadInherente: number;
  impactoInherente: number;
  respuesta?: string | undefined;
  contratoId?: string | undefined;
  responsableId?: string | undefined;
  frecuenciaRevisionDias?: number | undefined;
  proximaRevision?: Date | undefined;
  deteccionId?: string | undefined;
  creadoPorId: string;
}

export async function crearRiesgo(
  db: TenantTransactionClient,
  organisationId: string,
  datos: CrearRiesgoDatos,
): Promise<{ id: string; referencia: string; nivelInherente: string }> {
  const categoria = await db.categoriaRiesgo.findFirst({
    where: { id: datos.categoriaId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!categoria) {
    throw new ErrorDeCampo('categoriaId', 'Esa categoría ya no está disponible.');
  }
  if (datos.contratoId) {
    const contrato = await db.contrato.findFirst({
      where: { id: datos.contratoId, deletedAt: null },
      select: { id: true },
    });
    if (!contrato) throw new ErrorDeCampo('contratoId', 'Ese contrato ya no existe.');
  }
  if (datos.responsableId) {
    const responsable = await db.membership.findFirst({
      where: { userId: datos.responsableId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!responsable) {
      throw new ErrorDeCampo('responsableId', 'La persona responsable ya no está activa.');
    }
  }
  const bandas = await cargarBandasRiesgo(db);
  const frecuenciaRevisionDias = datos.frecuenciaRevisionDias ?? 90;
  const referencia = await siguienteReferenciaDe(
    async (prefijo) => {
      const ultima = await db.riesgo.findFirst({
        where: { referencia: { startsWith: prefijo } },
        select: { referencia: true },
        orderBy: { referencia: 'desc' },
      });
      return ultima?.referencia ?? null;
    },
    'RSG',
    new Date().getUTCFullYear(),
  );

  const riesgo = await db.riesgo.create({
    data: {
      organisationId,
      referencia,
      categoriaId: categoria.id,
      causa: datos.causa,
      evento: datos.evento,
      consecuencia: datos.consecuencia,
      probabilidadInherente: datos.probabilidadInherente,
      impactoInherente: datos.impactoInherente,
      respuesta: (datos.respuesta ?? 'MITIGAR') as never,
      contratoId: datos.contratoId ?? null,
      responsableId: datos.responsableId ?? null,
      frecuenciaRevisionDias,
      proximaRevision:
        datos.proximaRevision ??
        aDate(proximaRevisionDesde(hoyEn('Europe/Madrid'), frecuenciaRevisionDias)),
      deteccionId: datos.deteccionId ?? null,
      createdById: datos.creadoPorId,
    },
    select: { id: true, referencia: true },
  });

  const inherente = valorar(
    datos.probabilidadInherente as Escala,
    datos.impactoInherente as Escala,
    bandas,
  );
  await db.valoracionRiesgo.create({
    data: {
      organisationId,
      riesgoId: riesgo.id,
      tipo: 'INICIAL',
      probabilidadInherente: inherente.probabilidad,
      impactoInherente: inherente.impacto,
      puntuacionInherente: inherente.puntuacion,
      nivelInherente: inherente.nivel,
      justificacion: 'Valoración inherente registrada al identificar el riesgo.',
      bandas: bandas.map((banda) => ({ ...banda })) as Prisma.InputJsonValue,
      valoradaPorId: datos.creadoPorId,
      createdById: datos.creadoPorId,
    },
  });

  return { ...riesgo, nivelInherente: inherente.nivel };
}
