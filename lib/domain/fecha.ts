/**
 * Civil dates — a calendar day with no time and no timezone.
 *
 * Legal deadlines are counted in whole days: "quince días hábiles desde la
 * notificación" has nothing to do with hours, and a `Date` carrying a time and
 * an offset is a liability here. A deadline that slips a day because the server
 * runs in UTC and Madrid is on CEST is a lost right of appeal, not a rounding
 * error.
 *
 * A `FechaCivil` is the string `YYYY-MM-DD`. All arithmetic goes through UTC
 * internally, where days are always exactly 24 hours, so daylight saving cannot
 * shift a result.
 */

export type FechaCivil = string & { readonly __marca?: 'FechaCivil' };

const PATRON = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface PartesFecha {
  anio: number;
  /** 1–12, not the 0-based month of `Date`. */
  mes: number;
  dia: number;
}

export function esFechaCivil(valor: string): valor is FechaCivil {
  const coincidencia = PATRON.exec(valor);
  if (!coincidencia) return false;

  const [, a, m, d] = coincidencia;
  const anio = Number(a);
  const mes = Number(m);
  const dia = Number(d);

  if (mes < 1 || mes > 12) return false;
  if (dia < 1 || dia > diasEnMes(anio, mes)) return false;

  return true;
}

export function analizar(valor: string): PartesFecha {
  if (!esFechaCivil(valor)) {
    throw new Error(`Fecha civil no válida: "${valor}" (se espera AAAA-MM-DD)`);
  }

  const [a, m, d] = valor.split('-');
  return { anio: Number(a), mes: Number(m), dia: Number(d) };
}

function dosDigitos(n: number): string {
  return n < 10 ? `0${String(n)}` : String(n);
}

export function componer({ anio, mes, dia }: PartesFecha): FechaCivil {
  return `${String(anio).padStart(4, '0')}-${dosDigitos(mes)}-${dosDigitos(dia)}`;
}

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

export function diasEnMes(anio: number, mes: number): number {
  const largos = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mes === 2 && esBisiesto(anio)) return 29;
  return largos[mes - 1] ?? 30;
}

function aUtc(fecha: FechaCivil): number {
  const { anio, mes, dia } = analizar(fecha);
  return Date.UTC(anio, mes - 1, dia);
}

function desdeUtc(ms: number): FechaCivil {
  const d = new Date(ms);
  return componer({
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1,
    dia: d.getUTCDate(),
  });
}

const UN_DIA_MS = 86_400_000;

export function sumarDias(fecha: FechaCivil, dias: number): FechaCivil {
  return desdeUtc(aUtc(fecha) + dias * UN_DIA_MS);
}

export function diferenciaEnDias(desde: FechaCivil, hasta: FechaCivil): number {
  return Math.round((aUtc(hasta) - aUtc(desde)) / UN_DIA_MS);
}

export function comparar(a: FechaCivil, b: FechaCivil): number {
  return aUtc(a) - aUtc(b);
}

export function esAnterior(a: FechaCivil, b: FechaCivil): boolean {
  return comparar(a, b) < 0;
}

/** 1 = Monday … 7 = Sunday (ISO-8601, which is how Spanish calendars read). */
export function diaSemana(fecha: FechaCivil): number {
  const dia = new Date(aUtc(fecha)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

export function esSabadoODomingo(fecha: FechaCivil): boolean {
  return diaSemana(fecha) >= 6;
}

/**
 * Adds whole months "de fecha a fecha". When the target month has no equivalent
 * day the result is the last day of that month — 31 January plus one month is
 * 28 February (29 in a leap year), which is what art. 30.4 of Ley 39/2015
 * requires.
 */
export function sumarMeses(fecha: FechaCivil, meses: number): FechaCivil {
  const { anio, mes, dia } = analizar(fecha);

  const totalMeses = anio * 12 + (mes - 1) + meses;
  const nuevoAnio = Math.floor(totalMeses / 12);
  const nuevoMes = (totalMeses % 12) + 1;

  const maximo = diasEnMes(nuevoAnio, nuevoMes);

  return componer({ anio: nuevoAnio, mes: nuevoMes, dia: Math.min(dia, maximo) });
}

export function sumarAnios(fecha: FechaCivil, anios: number): FechaCivil {
  return sumarMeses(fecha, anios * 12);
}

/**
 * Today, as seen in a given IANA timezone. Never derive "today" from the
 * server's clock zone: a deadline check running at 00:30 in Madrid must not
 * read as the previous day because the process runs in UTC.
 */
export function hoyEn(zona = 'Europe/Madrid', ahora: Date = new Date()): FechaCivil {
  const formateador = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  // en-CA formats as YYYY-MM-DD, which is exactly the shape we want.
  return formateador.format(ahora);
}

/** Renders as `dd/MM/yyyy`, the Spanish convention (SPEC §8). */
export function formatearEs(fecha: FechaCivil): string {
  const { anio, mes, dia } = analizar(fecha);
  return `${dosDigitos(dia)}/${dosDigitos(mes)}/${String(anio)}`;
}
