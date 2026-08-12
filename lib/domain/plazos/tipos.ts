import type { FechaCivil } from '../fecha';

/**
 * How a deadline is counted. The two "working day" modes are genuinely
 * different rules, not one rule with a flag: August is inhábil for judicial
 * proceedings (art. 183 LOPJ) and perfectly ordinary for administrative ones,
 * so a single shared implementation would be wrong half the time.
 */
export type Computo =
  /** Working days before an administration — art. 30.2 Ley 39/2015. */
  | 'HABILES_ADMINISTRATIVO'
  /** Working days before a court — art. 182 LOPJ. */
  | 'HABILES_JUDICIAL'
  /** Every day counts, weekends and holidays included. */
  | 'NATURALES'
  /** De fecha a fecha — art. 30.4 Ley 39/2015. */
  | 'MESES'
  | 'ANOS';

export type MotivoExclusion =
  | 'SABADO'
  | 'DOMINGO'
  | 'FESTIVO_NACIONAL'
  | 'FESTIVO_AUTONOMICO'
  | 'FESTIVO_LOCAL'
  | 'AGOSTO_INHABIL'
  | 'INHABIL_JUDICIAL';

export interface DiaExcluido {
  fecha: FechaCivil;
  motivo: MotivoExclusion;
  /** Holiday name where one is known, e.g. "Fiesta del Trabajo". */
  nombre?: string;
}

export interface ResultadoPlazo {
  /** The deadline, already moved off a non-working day where required. */
  vencimiento: FechaCivil;
  /** First day counted — the day after the trigger (art. 30.3). */
  inicioComputo: FechaCivil;
  /** Every day skipped, with its reason, so a person can audit the result. */
  diasExcluidos: DiaExcluido[];
  /** Set when the deadline was pushed forward by art. 30.5. */
  prorrogadoPorInhabil: boolean;
  /** The legal basis, always shown next to the date. */
  fundamento: string;
  /**
   * False when a calendar the computation depended on was missing for some
   * year in range. The result is then a best effort and must never be
   * presented as final (SPEC §6.1).
   */
  completo: boolean;
  /** What was missing, when `completo` is false. */
  advertencias: string[];
}
