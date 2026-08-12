import {
  analizar,
  diaSemana,
  esSabadoODomingo,
  sumarAnios,
  sumarDias,
  sumarMeses,
  type FechaCivil,
} from '../fecha';
import { esInhabilJudicial, IndiceFestivos, type CalendarioAplicable } from './calendario';
import type { Computo, DiaExcluido, ResultadoPlazo } from './tipos';

/**
 * The deadline engine (SPEC §6.1).
 *
 * Pure: no I/O, no clock of its own, no database. Every result carries the days
 * it skipped and why, plus the article it rests on, so a person can check the
 * arithmetic by eye — which is the only way anyone should ever rely on it.
 *
 * ⚠️ These rules are an engineer's reading of Ley 39/2015 and the LOPJ. They
 * have NOT been reviewed by a Spanish lawyer. Until they are, no result may be
 * presented to a user as a confirmed legal deadline (SPEC §9, decision 1). A
 * mistake here costs a client their right of appeal.
 */

export interface ParametrosPlazo {
  /**
   * The triggering event — usually the date the notification took effect.
   * Counting starts the *following* day (art. 30.3 Ley 39/2015).
   */
  fechaInicio: FechaCivil;
  /** Number of days, months or years, per `computo`. */
  cantidad: number;
  computo: Computo;
  calendario: CalendarioAplicable;
  /**
   * Judicial deadlines only: certain urgent proceedings run through August
   * (art. 183 LOPJ). Whether a matter is urgent is a legal judgement, so the
   * caller decides and the engine records it.
   */
  agostoHabil?: boolean;
  /** Cite the specific article, e.g. "art. 44.2 LCSP — 15 días hábiles". */
  fundamento: string;
}

const LIMITE_ITERACIONES = 4000;

/** Is this day non-working for the given mode, and why? */
function diaInhabil(
  fecha: FechaCivil,
  computo: Computo,
  indice: IndiceFestivos,
  agostoHabil: boolean,
): DiaExcluido | undefined {
  if (computo === 'NATURALES') return undefined;

  if (esSabadoODomingo(fecha)) {
    // 6 = Saturday, 7 = Sunday in the ISO convention.
    return { fecha, motivo: diaSemana(fecha) === 6 ? 'SABADO' : 'DOMINGO' };
  }

  if (computo === 'HABILES_JUDICIAL') {
    const judicial = esInhabilJudicial(fecha, agostoHabil);
    if (judicial) return judicial;
  }

  return indice.buscar(fecha);
}

/**
 * Computes when a deadline falls.
 *
 * Day-based modes count only working days. Month and year modes count *de fecha
 * a fecha* — every intervening day counts, and only the final date is nudged
 * off a non-working day (art. 30.4 and 30.5).
 */
export function calcularVencimiento(parametros: ParametrosPlazo): ResultadoPlazo {
  const { fechaInicio, cantidad, computo, calendario, fundamento } = parametros;
  const agostoHabil = parametros.agostoHabil ?? false;

  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new Error('La cantidad de un plazo debe ser un entero positivo');
  }

  const indice = new IndiceFestivos(calendario);
  const diasExcluidos: DiaExcluido[] = [];

  // art. 30.3: counting begins the day after the notification, whatever the
  // unit. The trigger day itself is never counted.
  const inicioComputo = sumarDias(fechaInicio, 1);

  let vencimiento: FechaCivil;

  if (computo === 'MESES' || computo === 'ANOS') {
    // "de fecha a fecha": from the notification date, not from the day after,
    // so a notification on 15 March with a one-month deadline expires on
    // 15 April. Adding to `inicioComputo` instead is the classic off-by-one.
    vencimiento =
      computo === 'MESES'
        ? sumarMeses(fechaInicio, cantidad)
        : sumarAnios(fechaInicio, cantidad);
  } else {
    vencimiento = contarDias(
      inicioComputo,
      cantidad,
      computo,
      indice,
      agostoHabil,
      diasExcluidos,
    );
  }

  // art. 30.5: a deadline landing on a non-working day moves to the next one.
  let prorrogado = false;
  let guardia = 0;
  const modoProrroga = computoParaProrroga(computo);

  for (;;) {
    const excluido = diaInhabil(vencimiento, modoProrroga, indice, agostoHabil);
    if (!excluido) break;

    diasExcluidos.push(excluido);
    vencimiento = sumarDias(vencimiento, 1);
    prorrogado = true;

    guardia += 1;
    if (guardia > 400) {
      throw new Error('No se ha encontrado un día hábil para prorrogar el vencimiento');
    }
  }

  const advertencias = recopilarHuecos(indice, fechaInicio, vencimiento);

  return {
    vencimiento,
    inicioComputo,
    diasExcluidos,
    prorrogadoPorInhabil: prorrogado,
    fundamento,
    completo: advertencias.length === 0,
    advertencias,
  };
}

/**
 * Month and year deadlines still cannot end on a non-working day. Which
 * calendar decides that depends on the forum, so a judicial deadline expressed
 * in months uses the judicial notion of inhábil.
 */
function computoParaProrroga(computo: Computo): Computo {
  if (computo === 'HABILES_JUDICIAL') return 'HABILES_JUDICIAL';
  if (computo === 'NATURALES') return 'NATURALES';
  return 'HABILES_ADMINISTRATIVO';
}

function contarDias(
  inicio: FechaCivil,
  cantidad: number,
  computo: Computo,
  indice: IndiceFestivos,
  agostoHabil: boolean,
  diasExcluidos: DiaExcluido[],
): FechaCivil {
  let actual = inicio;
  let contados = 0;
  let iteraciones = 0;

  while (contados < cantidad) {
    const excluido = diaInhabil(actual, computo, indice, agostoHabil);

    if (excluido) {
      diasExcluidos.push(excluido);
    } else {
      contados += 1;
      if (contados === cantidad) return actual;
    }

    actual = sumarDias(actual, 1);

    iteraciones += 1;
    if (iteraciones > LIMITE_ITERACIONES) {
      throw new Error(
        'El cómputo del plazo no converge; revisa el calendario de festivos cargado',
      );
    }
  }

  return actual;
}

function recopilarHuecos(
  indice: IndiceFestivos,
  desde: FechaCivil,
  hasta: FechaCivil,
): string[] {
  const primero = analizar(desde).anio;
  const ultimo = analizar(hasta).anio;
  const advertencias = new Set<string>();

  for (let anio = primero; anio <= ultimo; anio += 1) {
    for (const hueco of indice.huecosPara(anio)) advertencias.add(hueco);
  }

  return [...advertencias];
}

/**
 * When a notification takes effect.
 *
 * art. 43.2 Ley 39/2015: an electronic notification not accessed within ten
 * natural days of being made available is treated as rejected, and the
 * procedure continues. The effective date is therefore the earlier of the
 * access and that tenth day.
 *
 * The result is a *proposal*. A person confirms it before any deadline is
 * treated as running (SPEC §2, principle 2) — the consequence of being wrong is
 * a missed appeal.
 */
export function fechaEfectosNotificacion(parametros: {
  puestaADisposicion: FechaCivil;
  fechaAcceso?: FechaCivil | undefined;
}): { fecha: FechaCivil; porRechazoTacito: boolean; fundamento: string } {
  const limiteRechazo = sumarDias(parametros.puestaADisposicion, 10);

  if (parametros.fechaAcceso && parametros.fechaAcceso <= limiteRechazo) {
    return {
      fecha: parametros.fechaAcceso,
      porRechazoTacito: false,
      fundamento: 'Fecha de acceso a la notificación',
    };
  }

  return {
    fecha: limiteRechazo,
    porRechazoTacito: true,
    fundamento:
      'Rechazo tácito: 10 días naturales desde la puesta a disposición sin acceder (art. 43.2 Ley 39/2015)',
  };
}
