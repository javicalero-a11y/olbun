import { comparar, diaSemana, sumarDias } from '../fecha';
import { diasLaborables, horasPorDiasLaborables, interseccion } from './ausencias';
import type { AdscripcionParaCobertura, AusenciaParaCobertura, Periodo } from './ausencias';
import type { FechaCivil } from '../fecha';

/**
 * The coverage planner (SPEC §5.6, M12).
 *
 * A grid of people against weeks: what each person is committed to, what an
 * absence takes back, and what is left. The question it answers is the one
 * asked in a planning meeting rather than an audit — not "were we covered last
 * month" but "who is short next week, and by how much".
 *
 * **Over-assignment is the finding that matters here.** Somebody assigned to
 * two contracts at sixty per cent each is over-committed on paper long before
 * anybody notices on the ground, and that is exactly the kind of thing a grid
 * shows and a list does not.
 *
 * Nothing in this module is drag-and-drop. The grid reads; assignments are
 * edited through the form that already exists. That is deliberate: a drag
 * interaction needs a keyboard equivalent designed with it (WCAG 2.2 AA,
 * 2.5.7), and shipping the drag first would mean shipping the inaccessible
 * half first.
 */

/** Monday of the week `fecha` falls in. ISO weeks: Monday is day 1. */
export function lunesDe(fecha: FechaCivil): FechaCivil {
  const dia = diaSemana(fecha);
  // `diaSemana` devuelve 0 para domingo, así que el domingo retrocede seis.
  const desplazamiento = dia === 0 ? 6 : dia - 1;
  return sumarDias(fecha, -desplazamiento);
}

export interface Semana {
  /** Monday. */
  desde: FechaCivil;
  /** Sunday. */
  hasta: FechaCivil;
  /** Working days in it, holidays already removed. */
  laborables: number;
}

export function semanasDe(
  periodo: Periodo,
  festivos: ReadonlySet<string> = new Set(),
): Semana[] {
  const semanas: Semana[] = [];
  let cursor = lunesDe(periodo.desde);

  while (comparar(cursor, periodo.hasta) <= 0) {
    const domingo = sumarDias(cursor, 6);
    semanas.push({
      desde: cursor,
      hasta: domingo,
      laborables: diasLaborables({ desde: cursor, hasta: domingo }, festivos),
    });
    cursor = sumarDias(cursor, 7);
  }

  return semanas;
}

export type EstadoCelda =
  /** Nothing assigned that week. */
  | 'LIBRE'
  /** Assigned and available. */
  | 'CUBIERTO'
  /** Assigned, but an absence takes part or all of it. */
  | 'AUSENTE'
  /** Committed to more hours than the working week holds. */
  | 'SOBREASIGNADO';

export interface Celda {
  semana: Semana;
  /** Hours the assignments promise this week. */
  comprometidas: number;
  /** Hours an absence removes. */
  ausentes: number;
  /** What is actually left. */
  disponibles: number;
  estado: EstadoCelda;
  /** Types of absence touching this week, for the cell's label. */
  motivos: string[];
}

export interface FilaPlanificador {
  empleadoId: string;
  nombre: string;
  celdas: Celda[];
  /** Hours available across the whole period. */
  totalDisponibles: number;
  /** True when any week is over-committed. */
  tieneSobreasignacion: boolean;
}

/**
 * The most hours a person can be committed to in one week before the plan is
 * arithmetically impossible.
 *
 * 40 is the ordinary full week in the sectors this serves. It is a ceiling for
 * *flagging*, not a limit the software enforces: a convenio may set less, and
 * overtime is a real thing that belongs to M13. Being told "this adds up to
 * more than a week" is useful; being blocked from recording reality is not.
 */
export const HORAS_SEMANA_COMPLETA = 40;

export function construirFila(
  empleadoId: string,
  nombre: string,
  semanas: readonly Semana[],
  adscripciones: readonly AdscripcionParaCobertura[],
  ausencias: readonly AusenciaParaCobertura[],
  etiquetaDeTipo: (tipo: AusenciaParaCobertura['tipo']) => string,
  festivos: ReadonlySet<string> = new Set(),
): FilaPlanificador {
  const suyas = adscripciones.filter((fila) => fila.empleadoId === empleadoId);
  const susAusencias = ausencias.filter((fila) => fila.empleadoId === empleadoId);

  const celdas = semanas.map((semana) => {
    const rango: Periodo = { desde: semana.desde, hasta: semana.hasta };

    let comprometidas = 0;
    for (const adscripcion of suyas) {
      const vigente = interseccion(adscripcion.periodo, rango);
      if (!vigente) continue;
      comprometidas += horasPorDiasLaborables(
        adscripcion.horasSemanales,
        diasLaborables(vigente, festivos),
      );
    }

    const motivos = new Set<string>();
    let ausentes = 0;

    for (const ausencia of susAusencias) {
      const solapado = interseccion(ausencia.periodo, rango);
      if (!solapado) continue;

      motivos.add(etiquetaDeTipo(ausencia.tipo));

      // Proporcional a lo comprometido esa semana: si no hay nada asignado, una
      // ausencia no resta horas de servicio, sólo disponibilidad personal.
      const diasAusente = diasLaborables(solapado, festivos);
      ausentes +=
        semana.laborables === 0 ? 0 : (comprometidas * diasAusente) / semana.laborables;
    }

    comprometidas = redondear(comprometidas);
    // Dos ausencias solapadas no pueden llevarse más de lo comprometido.
    ausentes = redondear(Math.min(ausentes, comprometidas));
    const disponibles = redondear(comprometidas - ausentes);

    return {
      semana,
      comprometidas,
      ausentes,
      disponibles,
      estado: estadoDeCelda(comprometidas, ausentes),
      motivos: [...motivos],
    };
  });

  return {
    empleadoId,
    nombre,
    celdas,
    totalDisponibles: redondear(celdas.reduce((total, celda) => total + celda.disponibles, 0)),
    tieneSobreasignacion: celdas.some((celda) => celda.estado === 'SOBREASIGNADO'),
  };
}

function estadoDeCelda(comprometidas: number, ausentes: number): EstadoCelda {
  // Se mira antes que la ausencia: estar sobreasignado y además de baja sigue
  // siendo un plan que no cuadra, y es lo que hay que arreglar primero.
  if (comprometidas > HORAS_SEMANA_COMPLETA) return 'SOBREASIGNADO';
  if (comprometidas === 0) return 'LIBRE';
  return ausentes > 0 ? 'AUSENTE' : 'CUBIERTO';
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * What each state means, in words.
 *
 * Every cell carries this text as well as its colour. Status is never encoded
 * in colour alone (AGENTS.md, WCAG 2.2 AA) — and public-sector buyers audit
 * exactly this.
 */
export const ETIQUETAS_CELDA: Readonly<Record<EstadoCelda, string>> = {
  LIBRE: 'Sin asignar',
  CUBIERTO: 'Cubierto',
  AUSENTE: 'Ausencia',
  SOBREASIGNADO: 'Sobreasignado',
};

export interface Proyeccion {
  /** Absence rate observed over the reference period, 0–1. */
  tasaHistorica: number;
  /** Hours the plan promises for the period ahead. */
  horasPlanificadas: number;
  /** Hours expected to be lost if the rate repeats. */
  horasEnRiesgo: number;
  /** False when there was too little history to say anything. */
  fiable: boolean;
}

/** Below this many observed hours the rate is noise, not a trend. */
export const HORAS_MINIMAS_PARA_PROYECTAR = 160;

/**
 * How much of next month is likely to go missing.
 *
 * Deliberately a single, explainable multiplication rather than a model: the
 * share of hours this contract actually lost over the reference window,
 * applied to what is planned. Anything cleverer would produce a number nobody
 * can argue with, which in a planning meeting is worse than a rough one people
 * can.
 *
 * `fiable` is false when the history is too thin to mean anything, and the
 * screen says so instead of printing a confident figure drawn from one week.
 */
export function proyectarCobertura(
  horasComprometidasHistoricas: number,
  horasPerdidasHistoricas: number,
  horasPlanificadas: number,
): Proyeccion {
  const fiable = horasComprometidasHistoricas >= HORAS_MINIMAS_PARA_PROYECTAR;
  const tasa =
    horasComprometidasHistoricas === 0
      ? 0
      : horasPerdidasHistoricas / horasComprometidasHistoricas;

  return {
    tasaHistorica: Math.round(tasa * 10000) / 10000,
    horasPlanificadas: redondear(horasPlanificadas),
    horasEnRiesgo: fiable ? redondear(horasPlanificadas * tasa) : 0,
    fiable,
  };
}
