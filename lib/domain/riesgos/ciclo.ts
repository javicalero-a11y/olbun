import { comparar, sumarDias, type FechaCivil } from '@/lib/domain/fecha';

import type { Valoracion } from './matriz';

export type EstadoAccionCorrectora =
  'PENDIENTE' | 'EN_CURSO' | 'BLOQUEADA' | 'COMPLETADA' | 'VERIFICADA' | 'CANCELADA';

const TRANSICIONES_ACCION: Readonly<
  Record<EstadoAccionCorrectora, readonly EstadoAccionCorrectora[]>
> = {
  PENDIENTE: ['EN_CURSO', 'BLOQUEADA', 'CANCELADA'],
  EN_CURSO: ['BLOQUEADA', 'COMPLETADA', 'CANCELADA'],
  BLOQUEADA: ['EN_CURSO', 'CANCELADA'],
  COMPLETADA: ['EN_CURSO', 'VERIFICADA'],
  VERIFICADA: [],
  CANCELADA: [],
};

export function puedeCambiarAccion(
  actual: EstadoAccionCorrectora,
  siguiente: EstadoAccionCorrectora,
): boolean {
  return actual === siguiente || TRANSICIONES_ACCION[actual].includes(siguiente);
}

export interface CambioAccion {
  actual: EstadoAccionCorrectora;
  siguiente: EstadoAccionCorrectora;
  progreso: number;
  motivoBloqueo?: string | undefined;
  eficacia?: string | undefined;
}

/** Returns every reason the state change cannot be committed. */
export function erroresCambioAccion(cambio: CambioAccion): string[] {
  const errores: string[] = [];

  if (!puedeCambiarAccion(cambio.actual, cambio.siguiente)) {
    errores.push(`No se puede pasar de ${cambio.actual} a ${cambio.siguiente}.`);
  }
  if (!Number.isInteger(cambio.progreso) || cambio.progreso < 0 || cambio.progreso > 100) {
    errores.push('El progreso debe ser un entero entre 0 y 100.');
  }
  if (cambio.siguiente === 'BLOQUEADA' && (cambio.motivoBloqueo?.trim().length ?? 0) < 5) {
    errores.push('Una acción bloqueada necesita explicar el bloqueo.');
  }
  if (
    (cambio.siguiente === 'COMPLETADA' || cambio.siguiente === 'VERIFICADA') &&
    cambio.progreso !== 100
  ) {
    errores.push('Una acción completada o verificada debe estar al 100 %.');
  }
  if (cambio.siguiente === 'VERIFICADA' && (cambio.eficacia?.trim().length ?? 0) < 10) {
    errores.push('La verificación debe explicar si la acción fue eficaz.');
  }

  return errores;
}

export function erroresValoracionResidual(
  inherente: Valoracion,
  residual: Valoracion,
  justificacion: string,
): string[] {
  if (residual.puntuacion <= inherente.puntuacion) return [];
  return justificacion.trim().length >= 20
    ? []
    : ['El riesgo residual es mayor que el inherente; explica por qué antes de guardar.'];
}

export function proximaRevisionDesde(
  fechaRevision: FechaCivil,
  frecuenciaDias: number,
): FechaCivil {
  if (!Number.isInteger(frecuenciaDias) || frecuenciaDias < 1 || frecuenciaDias > 3650) {
    throw new Error('La frecuencia de revisión debe estar entre 1 y 3.650 días.');
  }
  return sumarDias(fechaRevision, frecuenciaDias);
}

export type SituacionRevision = 'SIN_FECHA' | 'AL_DIA' | 'VENCE_HOY' | 'VENCIDA';

export function situacionRevision(
  proximaRevision: FechaCivil | null,
  hoy: FechaCivil,
): SituacionRevision {
  if (!proximaRevision) return 'SIN_FECHA';
  const comparacion = comparar(proximaRevision, hoy);
  if (comparacion < 0) return 'VENCIDA';
  if (comparacion === 0) return 'VENCE_HOY';
  return 'AL_DIA';
}

export type GravedadParaCierre = 'LEVE' | 'MODERADA' | 'GRAVE' | 'MUY_GRAVE';

export type EstadoInvestigacion = 'ABIERTA' | 'EN_INVESTIGACION' | 'CERRADA' | 'REABIERTA';

const TRANSICIONES_INCIDENCIA: Readonly<
  Record<EstadoInvestigacion, readonly EstadoInvestigacion[]>
> = {
  ABIERTA: ['EN_INVESTIGACION', 'CERRADA'],
  EN_INVESTIGACION: ['CERRADA'],
  CERRADA: ['REABIERTA'],
  REABIERTA: ['EN_INVESTIGACION', 'CERRADA'],
};

export function puedeCambiarIncidencia(
  actual: EstadoInvestigacion,
  siguiente: EstadoInvestigacion,
): boolean {
  return actual === siguiente || TRANSICIONES_INCIDENCIA[actual].includes(siguiente);
}

export function erroresCierreIncidencia(
  gravedad: GravedadParaCierre,
  causaRaiz: string | undefined,
  leccionesAprendidas: string | undefined,
): string[] {
  const errores: string[] = [];
  if ((causaRaiz?.trim().length ?? 0) < 10) {
    errores.push('Para cerrar una incidencia hay que documentar la causa raíz.');
  }
  if (
    (gravedad === 'GRAVE' || gravedad === 'MUY_GRAVE') &&
    (leccionesAprendidas?.trim().length ?? 0) < 10
  ) {
    errores.push('Una incidencia grave debe documentar las lecciones aprendidas.');
  }
  return errores;
}
