/**
 * Working out the hours in a day's work (SPEC §4.9.5, M13).
 *
 * Pure arithmetic over clock times, and the place the legal definitions live.
 * Three of them matter and none is a matter of taste:
 *
 * - **Night work is 22:00 to 06:00** (art. 36.1 ET). It is not "late" or "the
 *   night shift", it is those hours, and they are paid differently.
 * - **Breaks do not count as worked time** unless the convenio says they do,
 *   so they are subtracted and recorded separately rather than folded in.
 * - **Overtime is what exceeds the ordinary working day**, which comes from the
 *   contract or the convenio — not from a constant in this file. The caller
 *   passes it; a default here would quietly apply a 40-hour week to somebody on
 *   a 35-hour convenio and under-report their overtime.
 */

/** `HH:MM` on a 24-hour clock. */
export type HoraDelDia = string & { readonly __marca?: 'HoraDelDia' };

const FORMATO = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function esHoraDelDia(valor: string): valor is HoraDelDia {
  return FORMATO.test(valor);
}

export function aMinutos(hora: HoraDelDia): number {
  const [horas = '0', minutos = '0'] = hora.split(':');
  return Number(horas) * 60 + Number(minutos);
}

export function aHora(minutos: number): HoraDelDia {
  const normalizado = ((minutos % 1440) + 1440) % 1440;
  const horas = Math.floor(normalizado / 60);
  const resto = normalizado % 60;
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}` as HoraDelDia;
}

export interface Pausa {
  desde: HoraDelDia;
  hasta: HoraDelDia;
}

export interface Jornada {
  entrada: HoraDelDia;
  salida: HoraDelDia;
  pausas: readonly Pausa[];
  /** Ordinary hours for this person, from contract or convenio. */
  horasOrdinariasPactadas: number;
  /** True when the date is a Sunday or a holiday, which pays differently. */
  esFestivo: boolean;
}

export interface Horas {
  /** Total worked, breaks already removed. */
  trabajadas: number;
  ordinarias: number;
  extra: number;
  /** Of the worked hours, those falling between 22:00 and 06:00. */
  nocturnas: number;
  /** Worked hours on a Sunday or holiday. All of them, or none. */
  festivas: number;
  minutosDePausa: number;
}

const INICIO_NOCTURNO = 22 * 60;
const FIN_NOCTURNO = 6 * 60;
const MINUTOS_POR_DIA = 1440;

/**
 * Minutes of the shift that fall in the night band.
 *
 * A shift is expressed as a half-open interval on a timeline that may cross
 * midnight, so it is walked in absolute minutes from the day's start and the
 * night band is laid over it twice — the small hours of this day and the late
 * hours of it — because a 22:00–06:00 shift touches both.
 */
function minutosNocturnos(desde: number, hasta: number): number {
  const bandas: [number, number][] = [
    [0, FIN_NOCTURNO],
    [INICIO_NOCTURNO, MINUTOS_POR_DIA],
    [MINUTOS_POR_DIA, MINUTOS_POR_DIA + FIN_NOCTURNO],
    [MINUTOS_POR_DIA + INICIO_NOCTURNO, 2 * MINUTOS_POR_DIA],
  ];

  return bandas.reduce((total, [inicio, fin]) => {
    const solape = Math.min(hasta, fin) - Math.max(desde, inicio);
    return total + Math.max(0, solape);
  }, 0);
}

/** Absolute minutes, unrolling a shift that ends the next day. */
function tramo(entrada: HoraDelDia, salida: HoraDelDia): [number, number] {
  const inicio = aMinutos(entrada);
  const fin = aMinutos(salida);
  // Salir "antes" de entrar sólo puede significar que se cruzó la medianoche.
  return [inicio, fin <= inicio ? fin + MINUTOS_POR_DIA : fin];
}

export function calcularHoras(jornada: Jornada): Horas {
  const [inicio, fin] = tramo(jornada.entrada, jornada.salida);

  let minutosDePausa = 0;
  let nocturnosDePausa = 0;

  for (const pausa of jornada.pausas) {
    const [pausaInicio, pausaFin] = tramo(pausa.desde, pausa.hasta);
    // Una pausa antes de la entrada pertenece al tramo del día siguiente.
    const desplazada: [number, number] =
      pausaInicio < inicio
        ? [pausaInicio + MINUTOS_POR_DIA, pausaFin + MINUTOS_POR_DIA]
        : [pausaInicio, pausaFin];

    const solape = Math.min(desplazada[1], fin) - Math.max(desplazada[0], inicio);
    if (solape <= 0) continue;

    minutosDePausa += solape;
    nocturnosDePausa += minutosNocturnos(
      Math.max(desplazada[0], inicio),
      Math.min(desplazada[1], fin),
    );
  }

  const minutosTrabajados = fin - inicio - minutosDePausa;
  const trabajadas = redondear(minutosTrabajados / 60);
  const nocturnas = redondear((minutosNocturnos(inicio, fin) - nocturnosDePausa) / 60);

  const ordinarias = Math.min(trabajadas, jornada.horasOrdinariasPactadas);

  return {
    trabajadas,
    ordinarias: redondear(ordinarias),
    extra: redondear(Math.max(0, trabajadas - jornada.horasOrdinariasPactadas)),
    nocturnas: Math.max(0, nocturnas),
    // Un festivo lo es el día entero: no se reparte por horas.
    festivas: jornada.esFestivo ? trabajadas : 0,
    minutosDePausa,
  };
}

function redondear(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * The annual overtime ceiling: 80 hours per worker (art. 35.2 ET).
 *
 * Hours worked to prevent or repair extraordinary damage do not count towards
 * it, and neither do hours compensated with time off within four months. The
 * bag tracks the ones that do; the exclusions are a decision a person records,
 * not something software should infer from a timestamp.
 */
export const LIMITE_ANUAL_HORAS_EXTRA = 80;

/** Warn here rather than at the limit, so there is time to do something. */
export const UMBRAL_AVISO = 0.7;

export type EstadoBolsa = 'HOLGADA' | 'CERCA_DEL_LIMITE' | 'EN_EL_LIMITE' | 'EXCEDIDA';

export interface Bolsa {
  consumidas: number;
  restantes: number;
  porcentaje: number;
  estado: EstadoBolsa;
  /** Above the ceiling the law needs a reason, not just a warning. */
  requiereJustificacion: boolean;
}

export function evaluarBolsa(
  horasExtraAcumuladas: number,
  limite: number = LIMITE_ANUAL_HORAS_EXTRA,
): Bolsa {
  const porcentaje = limite === 0 ? 0 : redondear((horasExtraAcumuladas / limite) * 100);
  const restantes = redondear(Math.max(0, limite - horasExtraAcumuladas));

  const estado: EstadoBolsa =
    horasExtraAcumuladas > limite
      ? 'EXCEDIDA'
      : horasExtraAcumuladas === limite
        ? 'EN_EL_LIMITE'
        : horasExtraAcumuladas >= limite * UMBRAL_AVISO
          ? 'CERCA_DEL_LIMITE'
          : 'HOLGADA';

  return {
    consumidas: redondear(horasExtraAcumuladas),
    restantes,
    porcentaje,
    estado,
    requiereJustificacion: estado === 'EXCEDIDA' || estado === 'EN_EL_LIMITE',
  };
}

export const ETIQUETAS_BOLSA: Readonly<Record<EstadoBolsa, string>> = {
  HOLGADA: 'Dentro del límite',
  CERCA_DEL_LIMITE: 'Cerca del límite anual',
  EN_EL_LIMITE: 'En el límite anual',
  EXCEDIDA: 'Por encima del límite anual',
};
