import { comparar, diaSemana, esSabadoODomingo, sumarDias } from '../fecha';
import type { FechaCivil } from '../fecha';

/**
 * Absences and what they do to contractual coverage (SPEC §4.8, M12).
 *
 * M11 answered "who is assigned to this contract" with a static baseline. This
 * module answers the question the client actually asks in an inspection: **was
 * the service staffed on the day**. A pliego demands so many hours of a given
 * category at a given centre; an assignment promises them; an absence takes
 * them away again. Only the third makes the first two worth measuring.
 *
 * Two distinctions the whole module turns on, both easy to collapse and both
 * wrong to collapse:
 *
 * 1. **Availability is not absenteeism.** Holidays and paid statutory leave
 *    remove somebody from the shift exactly as sick leave does — the hours
 *    still have to be covered — but they are not absenteeism and must never be
 *    counted in an absenteeism rate. A rate that includes holidays says a
 *    compliant company is failing every August.
 * 2. **Absence is measured in working days, not calendar days.** A sick note
 *    covering Friday to Monday is four calendar days and two working ones. The
 *    Seguridad Social wants the first number; a coverage deficit is the second.
 *    Both are kept, and neither is derived from the other by guesswork.
 */

/** Whether the type is a medical leave, which drives its Seguridad Social treatment. */
export type FamiliaAusencia =
  | 'INCAPACIDAD_TEMPORAL'
  | 'NACIMIENTO_Y_CUIDADO'
  | 'PERMISO'
  | 'VACACIONES'
  | 'SUSPENSION'
  | 'NO_JUSTIFICADA';

export interface DefinicionAusencia {
  familia: FamiliaAusencia;
  etiqueta: string;
  /** Counts towards the absenteeism rate. Holidays and union hours do not. */
  computaAbsentismo: boolean;
  /**
   * Whether cover normally has to be arranged. Not the same as absenteeism: a
   * planned holiday is not absenteeism and still leaves a shift to fill.
   */
  requiereSustitucionPorDefecto: boolean;
  /** The employer keeps paying. Drives the cost split, not the coverage sum. */
  retribuida: boolean;
}

/**
 * The catalogue from SPEC §4.8.
 *
 * Spanish throughout because these are the terms on the parte de baja and in
 * the convenio; translating «excedencia» to «leave of absence» loses the legal
 * category that decides whether the post must be held open.
 */
export const TIPOS_AUSENCIA = {
  IT_CONTINGENCIA_COMUN: {
    familia: 'INCAPACIDAD_TEMPORAL',
    etiqueta: 'IT por contingencia común',
    computaAbsentismo: true,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  IT_CONTINGENCIA_PROFESIONAL: {
    familia: 'INCAPACIDAD_TEMPORAL',
    etiqueta: 'IT por contingencia profesional',
    computaAbsentismo: true,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  ACCIDENTE_TRABAJO: {
    familia: 'INCAPACIDAD_TEMPORAL',
    etiqueta: 'Accidente de trabajo',
    computaAbsentismo: true,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  ACCIDENTE_IN_ITINERE: {
    familia: 'INCAPACIDAD_TEMPORAL',
    etiqueta: 'Accidente in itinere',
    computaAbsentismo: true,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  ENFERMEDAD_PROFESIONAL: {
    familia: 'INCAPACIDAD_TEMPORAL',
    etiqueta: 'Enfermedad profesional',
    computaAbsentismo: true,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  NACIMIENTO_CUIDADO_MENOR: {
    familia: 'NACIMIENTO_Y_CUIDADO',
    etiqueta: 'Nacimiento y cuidado de menor',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  RIESGO_EMBARAZO: {
    familia: 'NACIMIENTO_Y_CUIDADO',
    etiqueta: 'Riesgo durante el embarazo',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  RIESGO_LACTANCIA: {
    familia: 'NACIMIENTO_Y_CUIDADO',
    etiqueta: 'Riesgo durante la lactancia',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  PERMISO_RETRIBUIDO: {
    familia: 'PERMISO',
    etiqueta: 'Permiso retribuido',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  PERMISO_NO_RETRIBUIDO: {
    familia: 'PERMISO',
    etiqueta: 'Permiso no retribuido',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: false,
  },
  EXCEDENCIA: {
    familia: 'SUSPENSION',
    etiqueta: 'Excedencia',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: false,
  },
  VACACIONES: {
    familia: 'VACACIONES',
    etiqueta: 'Vacaciones',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  HUELGA: {
    familia: 'SUSPENSION',
    etiqueta: 'Huelga',
    computaAbsentismo: false,
    // Cover during a strike is not a staffing decision to be nudged by
    // software: substituting strikers is unlawful (art. 6.5 RDL 17/1977) and
    // the services to maintain are the ones the authority decreed.
    requiereSustitucionPorDefecto: false,
    retribuida: false,
  },
  SANCION: {
    familia: 'SUSPENSION',
    etiqueta: 'Suspensión por sanción',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: false,
  },
  AUSENCIA_INJUSTIFICADA: {
    familia: 'NO_JUSTIFICADA',
    etiqueta: 'Ausencia injustificada',
    computaAbsentismo: true,
    requiereSustitucionPorDefecto: true,
    retribuida: false,
  },
  FORMACION: {
    familia: 'PERMISO',
    etiqueta: 'Formación',
    computaAbsentismo: false,
    requiereSustitucionPorDefecto: true,
    retribuida: true,
  },
  CREDITO_HORARIO_SINDICAL: {
    familia: 'PERMISO',
    etiqueta: 'Crédito horario sindical',
    computaAbsentismo: false,
    // Counting union hours as absenteeism, or flagging them as a staffing
    // problem, would put a number on the exercise of a right. It removes
    // availability and nothing more.
    requiereSustitucionPorDefecto: false,
    retribuida: true,
  },
} as const satisfies Record<string, DefinicionAusencia>;

export type TipoAusencia = keyof typeof TIPOS_AUSENCIA;

export function definicionDe(tipo: TipoAusencia): DefinicionAusencia {
  return TIPOS_AUSENCIA[tipo];
}

export const TIPOS_AUSENCIA_ORDENADOS = (Object.keys(TIPOS_AUSENCIA) as TipoAusencia[]).sort(
  (a, b) => TIPOS_AUSENCIA[a].etiqueta.localeCompare(TIPOS_AUSENCIA[b].etiqueta, 'es'),
);

export interface Periodo {
  desde: FechaCivil;
  /** Inclusive. An absence that ends today still removed today. */
  hasta: FechaCivil;
}

/** Days present in both periods, inclusive at both ends. Null when disjoint. */
export function interseccion(a: Periodo, b: Periodo): Periodo | null {
  const desde = comparar(a.desde, b.desde) >= 0 ? a.desde : b.desde;
  const hasta = comparar(a.hasta, b.hasta) <= 0 ? a.hasta : b.hasta;

  return comparar(desde, hasta) <= 0 ? { desde, hasta } : null;
}

export function seSolapan(a: Periodo, b: Periodo): boolean {
  return interseccion(a, b) !== null;
}

export function diasNaturales(periodo: Periodo): number {
  let total = 0;
  for (let dia = periodo.desde; comparar(dia, periodo.hasta) <= 0; dia = sumarDias(dia, 1)) {
    total += 1;
  }
  return total;
}

/**
 * Working days in a period.
 *
 * Saturdays and Sundays are out, and so is any date in `festivos`. The caller
 * supplies the holiday list because which calendar applies depends on the work
 * centre's municipio — there is no national answer, and guessing one would
 * quietly miscount every local fiesta.
 */
export function diasLaborables(
  periodo: Periodo,
  festivos: ReadonlySet<string> = new Set(),
): number {
  let total = 0;
  for (let dia = periodo.desde; comparar(dia, periodo.hasta) <= 0; dia = sumarDias(dia, 1)) {
    if (!esSabadoODomingo(dia) && !festivos.has(dia)) total += 1;
  }
  return total;
}

/** Working days an employee normally works in a week, from their schedule. */
export function diasLaborablesDeSemana(
  periodo: Periodo,
  festivos: ReadonlySet<string>,
  diasQueTrabaja: ReadonlySet<number>,
): number {
  let total = 0;
  for (let dia = periodo.desde; comparar(dia, periodo.hasta) <= 0; dia = sumarDias(dia, 1)) {
    if (diasQueTrabaja.has(diaSemana(dia)) && !festivos.has(dia)) total += 1;
  }
  return total;
}

export type EstadoAusencia = 'PREVISTA' | 'ACTIVA' | 'CERRADA';

export function estadoEn(periodo: Periodo, hoy: FechaCivil): EstadoAusencia {
  if (comparar(hoy, periodo.desde) < 0) return 'PREVISTA';
  return comparar(hoy, periodo.hasta) <= 0 ? 'ACTIVA' : 'CERRADA';
}

export interface AusenciaParaCobertura {
  empleadoId: string;
  tipo: TipoAusencia;
  periodo: Periodo;
}

export interface AdscripcionParaCobertura {
  empleadoId: string;
  categoriaId: string;
  centroTrabajo: string;
  /** Hours this assignment promises per week. */
  horasSemanales: number;
  periodo: Periodo;
}

export interface CoberturaReal {
  categoriaId: string;
  centroTrabajo: string;
  exigidas: number;
  /** What the assignments promise for the period, before absences. */
  adscritas: number;
  /** Hours removed by absences overlapping the period. */
  perdidasPorAusencia: number;
  /** `adscritas` minus `perdidasPorAusencia`. What was actually available. */
  disponibles: number;
  deficit: number;
  porcentaje: number;
}

const DIAS_LABORABLES_POR_SEMANA = 5;

/**
 * Turns a weekly commitment into the hours it represents over some days.
 *
 * A five-day week is assumed rather than read from a rota, and that is a real
 * simplification: somebody on a 3×12 shift pattern loses more per absent day
 * than this says. It is written down here, and on the screen, rather than
 * presented as a measurement — a wrong number nobody doubts is worse than an
 * approximate one everybody knows to check. Real rotas arrive with M13, when
 * clocked hours exist to read them from.
 */
export function horasPorDiasLaborables(horasSemanales: number, dias: number): number {
  return redondear((horasSemanales / DIAS_LABORABLES_POR_SEMANA) * dias);
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export interface ExigenciaParaCobertura {
  categoriaId: string;
  centroTrabajo: string;
  horasSemanales: number;
}

/**
 * Coverage for a period with absences taken off.
 *
 * This is the number that matters contractually: not who is on the payroll for
 * this contract, but how many hours of each category were actually available
 * at each centre. A deficit here is a penalty waiting to be written.
 */
export function coberturaRealPorCategoria(
  periodo: Periodo,
  exigencias: readonly ExigenciaParaCobertura[],
  adscripciones: readonly AdscripcionParaCobertura[],
  ausencias: readonly AusenciaParaCobertura[],
  festivos: ReadonlySet<string> = new Set(),
): CoberturaReal[] {
  const laborablesDelPeriodo = diasLaborables(periodo, festivos);
  const claves = new Set(
    [...exigencias, ...adscripciones].map((fila) =>
      clave(fila.categoriaId, fila.centroTrabajo),
    ),
  );

  return [...claves]
    .map((valor) => {
      const [categoriaId = '', centroTrabajo = ''] = valor.split(' ');

      const exigidas = redondear(
        exigencias
          .filter((fila) => coincide(fila, categoriaId, centroTrabajo))
          .reduce(
            (total, fila) =>
              total + horasPorDiasLaborables(fila.horasSemanales, laborablesDelPeriodo),
            0,
          ),
      );

      const propias = adscripciones.filter((fila) =>
        coincide(fila, categoriaId, centroTrabajo),
      );

      let adscritas = 0;
      let perdidas = 0;

      for (const adscripcion of propias) {
        // Only the part of the assignment that overlaps the period counts. An
        // assignment that started mid-month did not promise the whole month.
        const vigente = interseccion(adscripcion.periodo, periodo);
        if (!vigente) continue;

        const laborablesAdscritos = diasLaborables(vigente, festivos);
        adscritas += horasPorDiasLaborables(adscripcion.horasSemanales, laborablesAdscritos);

        for (const ausencia of ausencias) {
          if (ausencia.empleadoId !== adscripcion.empleadoId) continue;

          const ausente = interseccion(ausencia.periodo, vigente);
          if (!ausente) continue;

          perdidas += horasPorDiasLaborables(
            adscripcion.horasSemanales,
            diasLaborables(ausente, festivos),
          );
        }
      }

      adscritas = redondear(adscritas);
      // Overlapping absences must never remove more than was promised: two
      // absences on the same day are one absent day, not two.
      perdidas = redondear(Math.min(perdidas, adscritas));
      const disponibles = redondear(adscritas - perdidas);

      return {
        categoriaId,
        centroTrabajo,
        exigidas,
        adscritas,
        perdidasPorAusencia: perdidas,
        disponibles,
        deficit: redondear(Math.max(0, exigidas - disponibles)),
        porcentaje: exigidas === 0 ? 100 : redondear((disponibles / exigidas) * 100),
      };
    })
    .sort(
      (a, b) =>
        a.centroTrabajo.localeCompare(b.centroTrabajo, 'es') ||
        a.categoriaId.localeCompare(b.categoriaId),
    );
}

function clave(categoriaId: string, centroTrabajo: string): string {
  return `${categoriaId} ${centroTrabajo}`;
}

function coincide(
  fila: { categoriaId: string; centroTrabajo: string },
  categoriaId: string,
  centroTrabajo: string,
): boolean {
  return fila.categoriaId === categoriaId && fila.centroTrabajo === centroTrabajo;
}

export interface IndiceAbsentismo {
  /** Working days lost to types that count as absenteeism. */
  diasComputables: number;
  /** Working days theoretically available across the workforce. */
  diasTeoricos: number;
  /** Percentage, 0 when there is nothing to divide by. */
  porcentaje: number;
  /** Lost days by type, so a headline number can always be opened up. */
  porTipo: { tipo: TipoAusencia; dias: number }[];
}

/**
 * The absenteeism rate, counting only what absenteeism means.
 *
 * Holidays, union hours, birth and childcare leave are excluded on purpose. A
 * rate that swallows them is not a measure of absenteeism, it is a measure of
 * how many people took what they are entitled to — and it would be quoted at
 * somebody in a meeting as though it meant the first thing.
 */
export function indiceDeAbsentismo(
  periodo: Periodo,
  ausencias: readonly AusenciaParaCobertura[],
  plantillaMedia: number,
  festivos: ReadonlySet<string> = new Set(),
): IndiceAbsentismo {
  const porTipo = new Map<TipoAusencia, number>();
  let diasComputables = 0;

  for (const ausencia of ausencias) {
    if (!TIPOS_AUSENCIA[ausencia.tipo].computaAbsentismo) continue;

    const solapado = interseccion(ausencia.periodo, periodo);
    if (!solapado) continue;

    const dias = diasLaborables(solapado, festivos);
    diasComputables += dias;
    porTipo.set(ausencia.tipo, (porTipo.get(ausencia.tipo) ?? 0) + dias);
  }

  const diasTeoricos = diasLaborables(periodo, festivos) * plantillaMedia;

  return {
    diasComputables,
    diasTeoricos,
    porcentaje: diasTeoricos === 0 ? 0 : redondear((diasComputables / diasTeoricos) * 100),
    porTipo: [...porTipo.entries()]
      .map(([tipo, dias]) => ({ tipo, dias }))
      .sort((a, b) => b.dias - a.dias),
  };
}
