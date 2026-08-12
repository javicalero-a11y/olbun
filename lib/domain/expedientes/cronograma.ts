import {
  comparar,
  diferenciaEnDias,
  formatearEs,
  sumarDias,
  type FechaCivil,
} from '@/lib/domain/fecha';

/**
 * Geometry for the expediente timeline.
 *
 * Pure on purpose. The Gantt bars and the table underneath them are rendered
 * from this same structure, so the accessible version can never drift from the
 * picture — they are not two views of the data, they are one.
 *
 * Positions are percentages of the chart width, not pixels: the component
 * decides how wide it is, this decides where things sit inside it.
 */

export interface HitoCronograma {
  id: string;
  orden: number;
  nombre: string;
  tipo: string;
  estado: string;
  fechaPrevista?: FechaCivil | undefined;
  fechaReal?: FechaCivil | undefined;
  /** Present when the milestone is governed by a legal deadline. */
  plazo?:
    | {
        id: string;
        fechaInicio: FechaCivil;
        vencimiento: FechaCivil;
        esPreclusivo: boolean;
        calculoCompleto: boolean;
        fundamento: string;
      }
    | undefined;
}

export interface BarraCronograma {
  hitoId: string;
  nombre: string;
  orden: number;
  estado: string;
  /** Left edge, 0–100. */
  inicioPct: number;
  /** Width, 0–100. Never zero: a point in time still needs to be clickable. */
  anchoPct: number;
  desde: FechaCivil;
  hasta: FechaCivil;
  /** True when the bar spans a running deadline rather than marking a date. */
  esPlazo: boolean;
  esPreclusivo: boolean;
  calculoCompleto: boolean;
  /** Sentence read by screen readers and shown on hover. */
  descripcionAccesible: string;
}

export interface MarcaTemporal {
  fecha: FechaCivil;
  etiqueta: string;
  posicionPct: number;
}

export interface Cronograma {
  desde: FechaCivil;
  hasta: FechaCivil;
  totalDias: number;
  barras: BarraCronograma[];
  meses: MarcaTemporal[];
  /** Undefined when today falls outside the window shown. */
  hoyPct?: number | undefined;
}

/** Padding so the first and last bars are not glued to the frame. */
const MARGEN_DIAS = 3;

function fechasDe(hito: HitoCronograma): { desde: FechaCivil; hasta: FechaCivil } | undefined {
  if (hito.plazo) {
    return { desde: hito.plazo.fechaInicio, hasta: hito.plazo.vencimiento };
  }
  const fecha = hito.fechaReal ?? hito.fechaPrevista;
  return fecha ? { desde: fecha, hasta: fecha } : undefined;
}

function frase(hito: HitoCronograma, desde: FechaCivil, hasta: FechaCivil): string {
  if (hito.plazo) {
    const base = `${hito.nombre}: del ${formatearEs(desde)} al ${formatearEs(hasta)} (${hito.plazo.fundamento})`;
    const avisos: string[] = [];
    if (hito.plazo.esPreclusivo) avisos.push('plazo preclusivo');
    if (!hito.plazo.calculoCompleto) avisos.push('fecha sin verificar');
    return avisos.length > 0 ? `${base}. Atención: ${avisos.join(', ')}.` : `${base}.`;
  }
  const cuando = hito.fechaReal ? 'cumplido el' : 'previsto para el';
  return `${hito.nombre}: ${cuando} ${formatearEs(desde)}.`;
}

/**
 * Builds the timeline. Milestones with no date at all are dropped from the
 * chart — placing them at an invented position would be a lie — and the caller
 * lists them separately as "sin fecha".
 */
export function construirCronograma(
  hitos: HitoCronograma[],
  hoy: FechaCivil,
): Cronograma | undefined {
  const conFechas = hitos
    .map((hito) => ({ hito, rango: fechasDe(hito) }))
    .filter(
      (x): x is { hito: HitoCronograma; rango: { desde: FechaCivil; hasta: FechaCivil } } =>
        x.rango !== undefined,
    );

  if (conFechas.length === 0) return undefined;

  let min = conFechas[0]!.rango.desde;
  let max = conFechas[0]!.rango.hasta;
  for (const { rango } of conFechas) {
    if (comparar(rango.desde, min) < 0) min = rango.desde;
    if (comparar(rango.hasta, max) > 0) max = rango.hasta;
  }

  // Today is always visible: a timeline where "now" sits off-screen answers
  // the wrong question.
  if (comparar(hoy, min) < 0) min = hoy;
  if (comparar(hoy, max) > 0) max = hoy;

  const desde = sumarDias(min, -MARGEN_DIAS);
  const hasta = sumarDias(max, MARGEN_DIAS);
  const totalDias = Math.max(1, diferenciaEnDias(desde, hasta));

  const pct = (fecha: FechaCivil): number => (diferenciaEnDias(desde, fecha) / totalDias) * 100;

  const barras: BarraCronograma[] = conFechas
    .map(({ hito, rango }) => {
      const inicioPct = pct(rango.desde);
      // A single-day milestone still gets a visible, clickable target.
      const anchoPct = Math.max(pct(rango.hasta) - inicioPct, 1.2);

      return {
        hitoId: hito.id,
        nombre: hito.nombre,
        orden: hito.orden,
        estado: hito.estado,
        inicioPct,
        anchoPct,
        desde: rango.desde,
        hasta: rango.hasta,
        esPlazo: hito.plazo !== undefined,
        esPreclusivo: hito.plazo?.esPreclusivo ?? false,
        calculoCompleto: hito.plazo?.calculoCompleto ?? true,
        descripcionAccesible: frase(hito, rango.desde, rango.hasta),
      };
    })
    .sort((a, b) => a.orden - b.orden);

  return {
    desde,
    hasta,
    totalDias,
    barras,
    meses: marcasDeMes(desde, hasta, totalDias),
    hoyPct: pct(hoy),
  };
}

const MESES_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

/** One tick per month start inside the window, for the axis. */
export function marcasDeMes(
  desde: FechaCivil,
  hasta: FechaCivil,
  totalDias: number,
): MarcaTemporal[] {
  const marcas: MarcaTemporal[] = [];
  const [anioDesde, mesDesde] = [Number(desde.slice(0, 4)), Number(desde.slice(5, 7))];
  const [anioHasta, mesHasta] = [Number(hasta.slice(0, 4)), Number(hasta.slice(5, 7))];

  let anio = anioDesde;
  let mes = mesDesde;

  while (anio < anioHasta || (anio === anioHasta && mes <= mesHasta)) {
    const fecha = `${String(anio)}-${String(mes).padStart(2, '0')}-01` as FechaCivil;

    if (comparar(fecha, desde) >= 0 && comparar(fecha, hasta) <= 0) {
      marcas.push({
        fecha,
        // The year appears only in January, where the change matters.
        etiqueta: mes === 1 ? `${MESES_ES[0]!} ${String(anio)}` : MESES_ES[mes - 1]!,
        posicionPct: (diferenciaEnDias(desde, fecha) / totalDias) * 100,
      });
    }

    mes += 1;
    if (mes > 12) {
      mes = 1;
      anio += 1;
    }
  }

  return marcas;
}
