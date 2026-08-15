import 'server-only';

import type { Prisma, TipoAusencia } from '@prisma/client';

import {
  coberturaRealPorCategoria,
  definicionDe,
  diasLaborables,
  diasNaturales,
  estadoEn,
  indiceDeAbsentismo,
  seSolapan,
} from '@/lib/domain/personal/ausencias';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';
import { hoyEn } from '@/lib/domain/fecha';
import type { CoberturaReal, Periodo } from '@/lib/domain/personal/ausencias';
import type { FechaCivil } from '@/lib/domain/fecha';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * Recording absences and turning them into coverage (M12).
 *
 * The domain module decides what an absence means; this one reads and writes
 * it. Two things happen here and nowhere else:
 *
 * 1. **The day counts are computed once, when the absence is recorded**, and
 *    stored. Deriving them later would mean rebuilding the holiday calendar as
 *    it stood on the day — and a bank holiday added afterwards would silently
 *    rewrite a number that has already been reported to the Seguridad Social.
 * 2. **Overlaps are refused.** One person cannot be on holiday and on sick
 *    leave at once, and letting both exist would double-count the loss and put
 *    coverage below zero.
 */

const aDate = (fecha: FechaCivil): Date => new Date(`${fecha}T00:00:00.000Z`);
const aFecha = (fecha: Date): FechaCivil => fecha.toISOString().slice(0, 10);

/** An open-ended absence still has to be measured, so it counts to today. */
function periodoDe(
  inicio: FechaCivil,
  fin: FechaCivil | null,
  hoy: FechaCivil,
): { periodo: Periodo; abierta: boolean } {
  const cierre = fin ?? (inicio > hoy ? inicio : hoy);
  return { periodo: { desde: inicio, hasta: cierre }, abierta: fin === null };
}

export interface DatosAusencia {
  empleadoId: string;
  tipo: TipoAusencia;
  subtipo?: string | undefined;
  fechaInicio: FechaCivil;
  fechaFinPrevista?: FechaCivil | undefined;
  numeroParteSS?: string | undefined;
  mutua?: string | undefined;
  esRecaida: boolean;
  requiereSustitucion?: boolean | undefined;
  actorId: string;
}

export async function crearAusencia(
  db: TenantTransactionClient,
  organisationId: string,
  datos: DatosAusencia,
  festivos: ReadonlySet<string> = new Set(),
  hoy: FechaCivil = hoyEn(),
) {
  const empleado = await db.empleado.findFirst({
    where: { id: datos.empleadoId, deletedAt: null },
    select: { id: true },
  });

  if (!empleado) throw new ErrorDeCampo('empleadoId', 'Ese empleado no existe.');

  if (datos.fechaFinPrevista && datos.fechaFinPrevista < datos.fechaInicio) {
    throw new ErrorDeCampo('fechaFinPrevista', 'La fecha de fin es anterior al inicio.');
  }

  const { periodo } = periodoDe(datos.fechaInicio, datos.fechaFinPrevista ?? null, hoy);

  // Una persona no puede estar de vacaciones y de baja a la vez. Permitirlo
  // descontaría dos veces las mismas horas.
  const existentes = await db.ausencia.findMany({
    where: { empleadoId: datos.empleadoId, deletedAt: null },
    select: { id: true, fechaInicio: true, fechaFinPrevista: true, fechaFinReal: true },
  });

  for (const otra of existentes) {
    const fin = otra.fechaFinReal ?? otra.fechaFinPrevista;
    const suyo = periodoDe(aFecha(otra.fechaInicio), fin ? aFecha(fin) : null, hoy).periodo;

    if (seSolapan(periodo, suyo)) {
      throw new ErrorDeCampo(
        'fechaInicio',
        'Esa persona ya tiene otra ausencia registrada en esas fechas.',
      );
    }
  }

  const definicion = definicionDe(datos.tipo);

  return db.ausencia.create({
    data: {
      organisationId,
      empleadoId: datos.empleadoId,
      tipo: datos.tipo,
      subtipo: datos.subtipo ?? null,
      fechaInicio: aDate(datos.fechaInicio),
      fechaFinPrevista: datos.fechaFinPrevista ? aDate(datos.fechaFinPrevista) : null,
      diasNaturales: diasNaturales(periodo),
      diasLaborables: diasLaborables(periodo, festivos),
      numeroParteSS: datos.numeroParteSS ?? null,
      mutua: datos.mutua ?? null,
      esRecaida: datos.esRecaida,
      // El tipo propone y la persona decide: una huelga no propone sustituto
      // porque sustituir a quien la secunda es ilegal.
      requiereSustitucion:
        datos.requiereSustitucion ?? definicion.requiereSustitucionPorDefecto,
      estado: estadoEn(periodo, hoy),
      createdById: datos.actorId,
    },
    select: { id: true, tipo: true, diasLaborables: true, diasNaturales: true },
  });
}

/** Closes an absence with the date somebody actually came back. */
export async function cerrarAusencia(
  db: TenantTransactionClient,
  ausenciaId: string,
  fechaFinReal: FechaCivil,
  actorId: string,
  festivos: ReadonlySet<string> = new Set(),
) {
  const ausencia = await db.ausencia.findFirst({
    where: { id: ausenciaId, deletedAt: null },
    select: { id: true, fechaInicio: true },
  });

  if (!ausencia) throw new Error('La ausencia no existe.');

  const inicio = aFecha(ausencia.fechaInicio);
  if (fechaFinReal < inicio) {
    throw new ErrorDeCampo('fechaFinReal', 'La vuelta es anterior al inicio de la ausencia.');
  }

  const periodo: Periodo = { desde: inicio, hasta: fechaFinReal };

  return db.ausencia.update({
    where: { id: ausenciaId },
    data: {
      fechaFinReal: aDate(fechaFinReal),
      // Recalculadas contra la fecha real: el previsto era una estimación y lo
      // que se declara es lo que pasó.
      diasNaturales: diasNaturales(periodo),
      diasLaborables: diasLaborables(periodo, festivos),
      estado: 'CERRADA',
      updatedById: actorId,
    },
    select: { id: true, diasLaborables: true },
  });
}

const SELECCION_AUSENCIA = {
  id: true,
  tipo: true,
  subtipo: true,
  fechaInicio: true,
  fechaFinPrevista: true,
  fechaFinReal: true,
  diasNaturales: true,
  diasLaborables: true,
  estado: true,
  esRecaida: true,
  requiereSustitucion: true,
  numeroParteSS: true,
  empleado: { select: { id: true, nombre: true, apellidos: true, numeroEmpleado: true } },
} satisfies Prisma.AusenciaSelect;

export async function listarAusencias(db: TenantTransactionClient, hoy: FechaCivil = hoyEn()) {
  const filas = await db.ausencia.findMany({
    where: { deletedAt: null },
    select: SELECCION_AUSENCIA,
    orderBy: { fechaInicio: 'desc' },
    take: 300,
  });

  return filas.map((fila) => {
    const fin = fila.fechaFinReal ?? fila.fechaFinPrevista;
    const { periodo, abierta } = periodoDe(
      aFecha(fila.fechaInicio),
      fin ? aFecha(fin) : null,
      hoy,
    );

    return {
      ...fila,
      periodo,
      /** True when there is no end date: the count is "so far", not final. */
      abierta,
      // El estado guardado se calculó al grabar; una baja abierta pasa sola de
      // PREVISTA a ACTIVA con el paso de los días y la pantalla no debe
      // esperar a que alguien la toque para decirlo.
      estadoVigente: estadoEn(periodo, hoy),
      etiqueta: definicionDe(fila.tipo).etiqueta,
      computaAbsentismo: definicionDe(fila.tipo).computaAbsentismo,
    };
  });
}

export interface CoberturaDeContrato {
  filas: CoberturaReal[];
  totalExigidas: number;
  totalDisponibles: number;
  porcentaje: number;
}

/**
 * Real coverage for one contract over a period.
 *
 * This is what M11 could not answer. The baseline said who was assigned; this
 * says how many hours of each category were actually there once absences are
 * taken off — which is the number a client quotes when they open a penalty.
 */
export async function coberturaDeContrato(
  db: TenantTransactionClient,
  contratoId: string,
  periodo: Periodo,
  festivos: ReadonlySet<string> = new Set(),
): Promise<CoberturaDeContrato> {
  const [exigencias, adscripciones] = await Promise.all([
    db.plantillaExigida.findMany({
      where: { contratoId, deletedAt: null },
      select: { categoriaId: true, centroTrabajo: true, horasSemanales: true },
    }),
    db.adscripcionContrato.findMany({
      where: { contratoId, deletedAt: null },
      select: {
        empleadoId: true,
        categoriaId: true,
        centroTrabajo: true,
        horasSemanales: true,
        fechaAlta: true,
        fechaBaja: true,
      },
    }),
  ]);

  const empleadoIds = [...new Set(adscripciones.map((fila) => fila.empleadoId))];

  const ausencias =
    empleadoIds.length === 0
      ? []
      : await db.ausencia.findMany({
          where: {
            empleadoId: { in: empleadoIds },
            deletedAt: null,
            fechaInicio: { lte: aDate(periodo.hasta) },
          },
          select: {
            empleadoId: true,
            tipo: true,
            fechaInicio: true,
            fechaFinPrevista: true,
            fechaFinReal: true,
          },
        });

  const filas = coberturaRealPorCategoria(
    periodo,
    exigencias.map((fila) => ({
      categoriaId: fila.categoriaId,
      centroTrabajo: fila.centroTrabajo,
      horasSemanales: Number(fila.horasSemanales),
    })),
    adscripciones.map((fila) => ({
      empleadoId: fila.empleadoId,
      categoriaId: fila.categoriaId,
      centroTrabajo: fila.centroTrabajo,
      horasSemanales: Number(fila.horasSemanales),
      periodo: {
        desde: aFecha(fila.fechaAlta),
        // Sin baja, la adscripción sigue viva: se extiende hasta el final del
        // periodo que se está midiendo, no hasta hoy.
        hasta: fila.fechaBaja ? aFecha(fila.fechaBaja) : periodo.hasta,
      },
    })),
    ausencias.map((fila) => {
      const fin = fila.fechaFinReal ?? fila.fechaFinPrevista;
      return {
        empleadoId: fila.empleadoId,
        tipo: fila.tipo,
        periodo: {
          desde: aFecha(fila.fechaInicio),
          hasta: fin ? aFecha(fin) : periodo.hasta,
        },
      };
    }),
    festivos,
  );

  const totalExigidas = filas.reduce((total, fila) => total + fila.exigidas, 0);
  const totalDisponibles = filas.reduce((total, fila) => total + fila.disponibles, 0);

  return {
    filas,
    totalExigidas: Math.round(totalExigidas * 100) / 100,
    totalDisponibles: Math.round(totalDisponibles * 100) / 100,
    porcentaje:
      totalExigidas === 0 ? 100 : Math.round((totalDisponibles / totalExigidas) * 10000) / 100,
  };
}

/** The absenteeism rate for a period, over the live headcount. */
export async function absentismoDelPeriodo(
  db: TenantTransactionClient,
  periodo: Periodo,
  festivos: ReadonlySet<string> = new Set(),
) {
  const [ausencias, plantilla] = await Promise.all([
    db.ausencia.findMany({
      where: { deletedAt: null, fechaInicio: { lte: aDate(periodo.hasta) } },
      select: {
        empleadoId: true,
        tipo: true,
        fechaInicio: true,
        fechaFinPrevista: true,
        fechaFinReal: true,
      },
    }),
    db.empleado.count({ where: { deletedAt: null, estado: 'ACTIVO' } }),
  ]);

  return indiceDeAbsentismo(
    periodo,
    ausencias.map((fila) => {
      const fin = fila.fechaFinReal ?? fila.fechaFinPrevista;
      return {
        empleadoId: fila.empleadoId,
        tipo: fila.tipo,
        periodo: {
          desde: aFecha(fila.fechaInicio),
          hasta: fin ? aFecha(fin) : periodo.hasta,
        },
      };
    }),
    plantilla,
    festivos,
  );
}
