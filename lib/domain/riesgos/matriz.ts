/**
 * The 5×5 risk matrix (SPEC §4.6).
 *
 * A register is only useful if two people reading it reach the same
 * conclusion, so the bands live here — one place, pure, tested — rather than
 * being recomputed in each screen that colours a cell.
 *
 * Scores are never stored. The database keeps the 1–5 inputs a person chose;
 * the product and the band are derived. Storing the total would freeze
 * today's matrix into yesterday's rows, and the first time the bands were
 * retuned the register would be quietly inconsistent with itself.
 */

export type Escala = 1 | 2 | 3 | 4 | 5;

export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'MUY_ALTO';

export function esEscala(valor: number): valor is Escala {
  return Number.isInteger(valor) && valor >= 1 && valor <= 5;
}

/**
 * The bands.
 *
 * Deliberately not even quintiles of 1–25. The upper bands are narrower
 * because the top-right of the matrix is where attention has to go, while the
 * mass of 4s and 6s in the middle does not each need its own colour.
 *
 * The band is a function of the product alone, so it never falls as a score
 * rises. That costs something real: a catastrophic but very unlikely risk
 * scores 5 and sits in the middle band, where a safety matrix would often
 * lift it. Finding those is a filter on impact, not a bend in the scale —
 * bending it would mean a register that cannot be sorted by severity without
 * surprising the person reading it.
 */
const BANDAS: readonly { hasta: number; nivel: NivelRiesgo }[] = [
  { hasta: 4, nivel: 'BAJO' },
  { hasta: 9, nivel: 'MEDIO' },
  { hasta: 14, nivel: 'ALTO' },
  { hasta: 25, nivel: 'MUY_ALTO' },
];

export function puntuacion(probabilidad: Escala, impacto: Escala): number {
  return probabilidad * impacto;
}

export function nivelDe(probabilidad: Escala, impacto: Escala): NivelRiesgo {
  const total = puntuacion(probabilidad, impacto);
  return BANDAS.find((banda) => total <= banda.hasta)?.nivel ?? 'MUY_ALTO';
}

export const ETIQUETA_NIVEL: Readonly<Record<NivelRiesgo, string>> = {
  BAJO: 'Bajo',
  MEDIO: 'Medio',
  ALTO: 'Alto',
  MUY_ALTO: 'Muy alto',
};

export const ETIQUETA_PROBABILIDAD: Readonly<Record<Escala, string>> = {
  1: 'Muy improbable',
  2: 'Improbable',
  3: 'Posible',
  4: 'Probable',
  5: 'Casi seguro',
};

export const ETIQUETA_IMPACTO: Readonly<Record<Escala, string>> = {
  1: 'Insignificante',
  2: 'Menor',
  3: 'Moderado',
  4: 'Mayor',
  5: 'Crítico',
};

export interface Valoracion {
  probabilidad: Escala;
  impacto: Escala;
  puntuacion: number;
  nivel: NivelRiesgo;
}

export function valorar(probabilidad: Escala, impacto: Escala): Valoracion {
  return {
    probabilidad,
    impacto,
    puntuacion: puntuacion(probabilidad, impacto),
    nivel: nivelDe(probabilidad, impacto),
  };
}

/**
 * Reads the residual assessment, which may not exist.
 *
 * "Not yet assessed" and "unchanged by the controls" are different facts about
 * a risk, and collapsing the first into the second is how a register comes to
 * claim that every risk has been treated. A null residual stays null.
 */
export function valorarResidual(
  probabilidad: number | null | undefined,
  impacto: number | null | undefined,
): Valoracion | null {
  if (probabilidad == null || impacto == null) return null;
  if (!esEscala(probabilidad) || !esEscala(impacto)) return null;

  return valorar(probabilidad, impacto);
}

/**
 * How much the controls actually bought, as a share of the inherent score.
 *
 * Reported rather than judged: a small reduction on a low risk may be
 * perfectly proportionate, and the register should not imply otherwise.
 * Negative when the residual is worse than the inherent — which usually means
 * somebody mis-scored one of them, and is worth seeing rather than clamping.
 */
export function reduccion(inherente: Valoracion, residual: Valoracion | null): number | null {
  if (!residual) return null;

  return Number(
    ((inherente.puntuacion - residual.puntuacion) / inherente.puntuacion).toFixed(4),
  );
}

/**
 * The score the register should be sorted and filtered on: the residual where
 * one exists, otherwise the inherent.
 *
 * Sorting on the inherent would bury the risks somebody has already looked at
 * under ones nobody has; sorting on a residual that defaults to the inherent
 * would hide the unassessed ones. This keeps the unassessed visible at their
 * full weight, which is the honest position — nobody has yet shown they are
 * smaller than they look.
 */
export function nivelVigente(inherente: Valoracion, residual: Valoracion | null): Valoracion {
  return residual ?? inherente;
}

/** Every cell of the matrix, for drawing the heat map. */
export function celdas(): { probabilidad: Escala; impacto: Escala; nivel: NivelRiesgo }[] {
  const escalas: Escala[] = [1, 2, 3, 4, 5];

  return escalas.flatMap((probabilidad) =>
    escalas.map((impacto) => ({
      probabilidad,
      impacto,
      nivel: nivelDe(probabilidad, impacto),
    })),
  );
}
