import { analizar, type FechaCivil } from '../fecha';
import type { DiaExcluido, MotivoExclusion } from './tipos';

/**
 * Holiday calendars.
 *
 * Spain has three overlapping layers — national, autonomous and local — and a
 * day is a holiday if *any* layer says so. The applicable municipal calendar is
 * the reason this cannot be a single global list: 15 May is a holiday in Madrid
 * and an ordinary working day in Seville, and a deadline computed with the
 * wrong one is simply wrong.
 *
 * Which municipality governs when the interested party and the órgano sit in
 * different places is a live legal question, flagged in SPEC §9 for counsel.
 * This module takes the calendars it is given and does not decide that.
 */

export interface Festivo {
  fecha: FechaCivil;
  nombre: string;
}

export interface CalendarioAmbito {
  /** Years this calendar has been loaded and verified for. */
  aniosCubiertos: readonly number[];
  festivos: readonly Festivo[];
}

export interface CalendarioAplicable {
  nacional: CalendarioAmbito;
  autonomico?: CalendarioAmbito;
  local?: CalendarioAmbito;
}

interface EntradaIndice {
  motivo: MotivoExclusion;
  nombre: string;
}

/**
 * Pre-indexed calendar. Building it once and reusing it keeps the hot loop of
 * the deadline computation to a hash lookup per day.
 */
export class IndiceFestivos {
  private readonly porFecha: ReadonlyMap<string, EntradaIndice>;
  private readonly aniosNacional: ReadonlySet<number>;
  private readonly aniosAutonomico: ReadonlySet<number> | undefined;
  private readonly aniosLocal: ReadonlySet<number> | undefined;
  readonly tieneAutonomico: boolean;
  readonly tieneLocal: boolean;

  constructor(calendario: CalendarioAplicable) {
    const indice = new Map<string, EntradaIndice>();

    // Ordered narrowest-last so a municipal entry keeps its own label when a
    // day is a holiday at more than one level.
    for (const festivo of calendario.nacional.festivos) {
      indice.set(festivo.fecha, { motivo: 'FESTIVO_NACIONAL', nombre: festivo.nombre });
    }
    for (const festivo of calendario.autonomico?.festivos ?? []) {
      indice.set(festivo.fecha, { motivo: 'FESTIVO_AUTONOMICO', nombre: festivo.nombre });
    }
    for (const festivo of calendario.local?.festivos ?? []) {
      indice.set(festivo.fecha, { motivo: 'FESTIVO_LOCAL', nombre: festivo.nombre });
    }

    this.porFecha = indice;
    this.aniosNacional = new Set(calendario.nacional.aniosCubiertos);
    this.aniosAutonomico = calendario.autonomico
      ? new Set(calendario.autonomico.aniosCubiertos)
      : undefined;
    this.aniosLocal = calendario.local ? new Set(calendario.local.aniosCubiertos) : undefined;
    this.tieneAutonomico = Boolean(calendario.autonomico);
    this.tieneLocal = Boolean(calendario.local);
  }

  buscar(fecha: FechaCivil): DiaExcluido | undefined {
    const entrada = this.porFecha.get(fecha);
    if (!entrada) return undefined;

    return { fecha, motivo: entrada.motivo, nombre: entrada.nombre };
  }

  /**
   * Reports which layers lack data for a year. A missing layer does not stop
   * the calculation — it marks the result incomplete, which the UI must show
   * rather than presenting a confident date built on a gap.
   */
  huecosPara(anio: number): string[] {
    const faltan: string[] = [];

    if (!this.aniosNacional.has(anio)) {
      faltan.push(`No hay calendario nacional cargado para ${String(anio)}`);
    }
    if (this.aniosAutonomico && !this.aniosAutonomico.has(anio)) {
      faltan.push(`No hay calendario autonómico cargado para ${String(anio)}`);
    }
    if (this.aniosLocal && !this.aniosLocal.has(anio)) {
      faltan.push(`No hay calendario local cargado para ${String(anio)}`);
    }
    if (!this.tieneLocal) {
      faltan.push(
        'No se ha indicado calendario local; los festivos municipales no se han tenido en cuenta',
      );
    }

    return faltan;
  }
}

/**
 * Days that are inhábil for judicial proceedings on top of the ordinary
 * holidays: the whole of August, and 24 and 31 December (art. 182 LOPJ).
 *
 * Certain urgent proceedings are exempt from the August rule. The engine does
 * not attempt to infer urgency — the caller marks a plazo as urgent, because
 * that is a legal judgement rather than a calendar fact.
 */
export function esInhabilJudicial(
  fecha: FechaCivil,
  agostoHabil: boolean,
): DiaExcluido | undefined {
  const { mes, dia } = analizar(fecha);

  if (mes === 8 && !agostoHabil) {
    return { fecha, motivo: 'AGOSTO_INHABIL', nombre: 'Agosto inhábil (art. 183 LOPJ)' };
  }

  if (mes === 12 && (dia === 24 || dia === 31)) {
    return { fecha, motivo: 'INHABIL_JUDICIAL', nombre: 'Inhábil a efectos procesales' };
  }

  return undefined;
}
