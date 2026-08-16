import 'server-only';

import {
  construirFila,
  proyectarCobertura,
  semanasDe,
} from '@/lib/domain/personal/planificador';
import { definicionDe } from '@/lib/domain/personal/ausencias';
import { sumarDias } from '@/lib/domain/fecha';
import type {
  AdscripcionParaCobertura,
  AusenciaParaCobertura,
  Periodo,
} from '@/lib/domain/personal/ausencias';
import type { FechaCivil } from '@/lib/domain/fecha';
import type { FilaPlanificador, Proyeccion, Semana } from '@/lib/domain/personal/planificador';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * Feeding the coverage planner (SPEC §5.6, M12).
 *
 * Reads the assignments and absences for one contract over a window and hands
 * the domain module what it needs. Read-only by design: assignments are edited
 * through the form that already exists, because a drag interaction owes a
 * keyboard equivalent (WCAG 2.2 AA, 2.5.7) and half of that is worse than
 * neither.
 */

const aFecha = (fecha: Date): FechaCivil => fecha.toISOString().slice(0, 10);
const aDate = (fecha: FechaCivil): Date => new Date(`${fecha}T00:00:00.000Z`);

export interface PlanificadorDeContrato {
  semanas: Semana[];
  filas: FilaPlanificador[];
  proyeccion: Proyeccion;
  /** Nobody assigned: the grid would be empty and the screen says why. */
  sinPlantilla: boolean;
}

export async function planificadorDeContrato(
  db: TenantTransactionClient,
  contratoId: string,
  periodo: Periodo,
  festivos: ReadonlySet<string> = new Set(),
): Promise<PlanificadorDeContrato> {
  const adscripciones = await db.adscripcionContrato.findMany({
    where: { contratoId, deletedAt: null },
    select: {
      empleadoId: true,
      categoriaId: true,
      centroTrabajo: true,
      horasSemanales: true,
      fechaAlta: true,
      fechaBaja: true,
      empleado: { select: { nombre: true, apellidos: true, numeroEmpleado: true } },
    },
    orderBy: { empleado: { apellidos: 'asc' } },
  });

  const semanas = semanasDe(periodo, festivos);

  if (adscripciones.length === 0) {
    return {
      semanas,
      filas: [],
      proyeccion: proyectarCobertura(0, 0, 0),
      sinPlantilla: true,
    };
  }

  const empleadoIds = [...new Set(adscripciones.map((fila) => fila.empleadoId))];

  // La ventana de historia: los tres meses anteriores al periodo que se
  // planifica. Suficiente para que una racha no marque la tendencia y corto
  // como para que siga hablando de esta época del año.
  const historia: Periodo = { desde: haceMeses(periodo.desde, 3), hasta: periodo.desde };

  const ausencias = await db.ausencia.findMany({
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

  const paraDominio = (limite: FechaCivil): AusenciaParaCobertura[] =>
    ausencias.map((fila) => {
      const fin = fila.fechaFinReal ?? fila.fechaFinPrevista;
      return {
        empleadoId: fila.empleadoId,
        tipo: fila.tipo,
        periodo: { desde: aFecha(fila.fechaInicio), hasta: fin ? aFecha(fin) : limite },
      };
    });

  const adscripcionesDominio: AdscripcionParaCobertura[] = adscripciones.map((fila) => ({
    empleadoId: fila.empleadoId,
    categoriaId: fila.categoriaId,
    centroTrabajo: fila.centroTrabajo,
    horasSemanales: Number(fila.horasSemanales),
    periodo: {
      desde: aFecha(fila.fechaAlta),
      hasta: fila.fechaBaja ? aFecha(fila.fechaBaja) : periodo.hasta,
    },
  }));

  const etiquetaDeTipo = (tipo: AusenciaParaCobertura['tipo']) => definicionDe(tipo).etiqueta;

  const filas = empleadoIds.map((empleadoId) => {
    const suya = adscripciones.find((fila) => fila.empleadoId === empleadoId);
    const nombre = suya ? `${suya.empleado.apellidos}, ${suya.empleado.nombre}` : 'Persona';

    return construirFila(
      empleadoId,
      nombre,
      semanas,
      adscripcionesDominio,
      paraDominio(periodo.hasta),
      etiquetaDeTipo,
      festivos,
    );
  });

  // La proyección se apoya en lo realmente perdido en la ventana de historia,
  // no en una media del sector: la pregunta es qué pasa en ESTE contrato.
  const semanasHistoricas = semanasDe(historia, festivos);
  const filasHistoricas = empleadoIds.map((empleadoId) =>
    construirFila(
      empleadoId,
      '',
      semanasHistoricas,
      adscripcionesDominio,
      paraDominio(historia.hasta),
      etiquetaDeTipo,
      festivos,
    ),
  );

  const comprometidasHistoricas = sumar(filasHistoricas, 'comprometidas');
  const perdidasHistoricas = sumar(filasHistoricas, 'ausentes');
  const planificadas = sumar(filas, 'comprometidas');

  return {
    semanas,
    filas,
    proyeccion: proyectarCobertura(comprometidasHistoricas, perdidasHistoricas, planificadas),
    sinPlantilla: false,
  };
}

function sumar(
  filas: readonly FilaPlanificador[],
  campo: 'comprometidas' | 'ausentes',
): number {
  return filas.reduce(
    (total, fila) => total + fila.celdas.reduce((suma, celda) => suma + celda[campo], 0),
    0,
  );
}

/** Same day, `meses` months earlier. Clamps a short month rather than rolling. */
function haceMeses(fecha: FechaCivil, meses: number): FechaCivil {
  const [anio = 0, mes = 1, dia = 1] = fecha.split('-').map(Number);
  const destino = new Date(Date.UTC(anio, mes - 1 - meses, 1));
  const ultimoDia = new Date(
    Date.UTC(destino.getUTCFullYear(), destino.getUTCMonth() + 1, 0),
  ).getUTCDate();

  destino.setUTCDate(Math.min(dia, ultimoDia));
  return aFecha(destino);
}

/** The window the planner opens on: this week and the seven after it. */
export function ventanaPorDefecto(hoy: FechaCivil): Periodo {
  return { desde: hoy, hasta: sumarDias(hoy, 7 * 8 - 1) };
}
