/**
 * The 5×5 risk matrix (SPEC §4.6).
 *
 * A register is only useful if two people reading it reach the same
 * conclusion, so the bands live here — one place, pure, tested — rather than
 * being recomputed in each screen that colours a cell.
 *
 * The live risk stores the 1–5 inputs and derives the band against the current
 * tenant configuration. Immutable assessment snapshots also preserve the
 * product and the bands in force that day, so changing the matrix never
 * rewrites history.
 */

export type Escala = 1 | 2 | 3 | 4 | 5;

export type NivelRiesgo = 'BAJO' | 'MEDIO' | 'ALTO' | 'MUY_ALTO';

export interface BandaMatriz {
  nivel: NivelRiesgo;
  nombre: string;
  desde: number;
  hasta: number;
  color: string;
}

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
export const BANDAS_POR_DEFECTO: readonly BandaMatriz[] = [
  { nivel: 'BAJO', nombre: 'Bajo', desde: 1, hasta: 4, color: '#64748b' },
  { nivel: 'MEDIO', nombre: 'Medio', desde: 5, hasta: 9, color: '#d97706' },
  { nivel: 'ALTO', nombre: 'Alto', desde: 10, hasta: 15, color: '#dc2626' },
  { nivel: 'MUY_ALTO', nombre: 'Muy alto', desde: 16, hasta: 25, color: '#991b1b' },
];

const ORDEN_NIVELES: readonly NivelRiesgo[] = ['BAJO', 'MEDIO', 'ALTO', 'MUY_ALTO'];

/**
 * A valid configuration covers 1..25 exactly once and preserves the semantic
 * order of the four levels. Gaps and overlaps fall back to the safe default;
 * no screen should disagree with another because one accepted malformed JSON.
 */
export function sonBandasValidas(bandas: readonly BandaMatriz[]): boolean {
  if (bandas.length !== ORDEN_NIVELES.length) return false;

  const ordenadas = [...bandas].sort((a, b) => a.desde - b.desde);
  return ordenadas.every((banda, indice) => {
    const anterior = ordenadas[indice - 1];
    return (
      banda.nivel === ORDEN_NIVELES[indice] &&
      Number.isInteger(banda.desde) &&
      Number.isInteger(banda.hasta) &&
      banda.desde >= 1 &&
      banda.hasta <= 25 &&
      banda.desde <= banda.hasta &&
      (indice === 0 ? banda.desde === 1 : banda.desde === (anterior?.hasta ?? 0) + 1) &&
      (indice !== ordenadas.length - 1 || banda.hasta === 25)
    );
  });
}

export function normalizarBandas(bandas?: readonly BandaMatriz[]): readonly BandaMatriz[] {
  return bandas && sonBandasValidas(bandas)
    ? [...bandas].sort((a, b) => a.desde - b.desde)
    : BANDAS_POR_DEFECTO;
}

/** Safely restores the matrix embedded in an immutable database snapshot. */
export function bandasDesdeDesconocido(valor: unknown): readonly BandaMatriz[] {
  if (!Array.isArray(valor)) return BANDAS_POR_DEFECTO;

  const candidatas: BandaMatriz[] = [];
  for (const elemento of valor) {
    if (!elemento || typeof elemento !== 'object') return BANDAS_POR_DEFECTO;
    const banda = elemento as Record<string, unknown>;
    if (
      !ORDEN_NIVELES.includes(banda['nivel'] as NivelRiesgo) ||
      typeof banda['nombre'] !== 'string' ||
      typeof banda['desde'] !== 'number' ||
      typeof banda['hasta'] !== 'number' ||
      typeof banda['color'] !== 'string'
    ) {
      return BANDAS_POR_DEFECTO;
    }
    candidatas.push({
      nivel: banda['nivel'] as NivelRiesgo,
      nombre: banda['nombre'],
      desde: banda['desde'],
      hasta: banda['hasta'],
      color: banda['color'],
    });
  }

  return normalizarBandas(candidatas);
}

export function nombreDeNivel(nivel: NivelRiesgo, bandas?: readonly BandaMatriz[]): string {
  return (
    normalizarBandas(bandas).find((banda) => banda.nivel === nivel)?.nombre ??
    ETIQUETA_NIVEL[nivel]
  );
}

export function puntuacion(probabilidad: Escala, impacto: Escala): number {
  return probabilidad * impacto;
}

export function nivelDe(
  probabilidad: Escala,
  impacto: Escala,
  bandas?: readonly BandaMatriz[],
): NivelRiesgo {
  const total = puntuacion(probabilidad, impacto);
  return (
    normalizarBandas(bandas).find((banda) => total >= banda.desde && total <= banda.hasta)
      ?.nivel ?? 'MUY_ALTO'
  );
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

export function valorar(
  probabilidad: Escala,
  impacto: Escala,
  bandas?: readonly BandaMatriz[],
): Valoracion {
  return {
    probabilidad,
    impacto,
    puntuacion: puntuacion(probabilidad, impacto),
    nivel: nivelDe(probabilidad, impacto, bandas),
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
  bandas?: readonly BandaMatriz[],
): Valoracion | null {
  if (probabilidad == null || impacto == null) return null;
  if (!esEscala(probabilidad) || !esEscala(impacto)) return null;

  return valorar(probabilidad, impacto, bandas);
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
export function celdas(
  bandas?: readonly BandaMatriz[],
): { probabilidad: Escala; impacto: Escala; nivel: NivelRiesgo }[] {
  const escalas: Escala[] = [1, 2, 3, 4, 5];

  return escalas.flatMap((probabilidad) =>
    escalas.map((impacto) => ({
      probabilidad,
      impacto,
      nivel: nivelDe(probabilidad, impacto, bandas),
    })),
  );
}
