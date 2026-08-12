import { calcularVencimiento } from '@/lib/domain/plazos/computo';
import type { CalendarioAplicable } from '@/lib/domain/plazos/calendario';
import type { Computo, ResultadoPlazo } from '@/lib/domain/plazos/tipos';
import { sumarDias, type FechaCivil } from '@/lib/domain/fecha';

/**
 * Turns a procedure template into a dated plan.
 *
 * The rule that matters here: **each step's clock starts from the step before
 * it, not from the opening date**. A deadline to appeal runs from the decision
 * being appealed; computing it from the day the file was opened would show an
 * appeal window closing weeks before the decision it attacks exists.
 *
 * The second rule follows from the first: once the chain passes through a date
 * that is only an estimate — "the órgano usually resolves in about 45 days" —
 * every date after it is an estimate too, and is marked incomplete no matter
 * how sound the calendar arithmetic on top of it was.
 *
 * Pure, so the seed data and the application produce identical plans and this
 * rule can be tested without a database.
 */

export interface PasoPlantilla {
  orden: number;
  nombre: string;
  plazoCantidad?: number | null;
  plazoComputo?: string | null;
  plazoFundamento?: string | null;
  plazoEsPreclusivo?: boolean;
  desplazamientoDias?: number | null;
}

export interface PasoPlanificado {
  orden: number;
  /** The date this step's clock starts from. */
  inicio: FechaCivil;
  /** Set when the step is governed by a legal deadline. */
  plazo?:
    | {
        resultado: ResultadoPlazo;
        cantidad: number;
        computo: Computo;
        fundamento: string;
        esPreclusivo: boolean;
        /** False when the calculation rests on an unverified or estimated date. */
        completo: boolean;
        advertencias: string[];
      }
    | undefined;
  /** The date to show on the timeline, deadline or offset alike. */
  fechaPrevista?: FechaCivil | undefined;
  /** True when this step's date descends from a planning estimate. */
  estimada: boolean;
}

const AVISO_ESTIMADA =
  'El cómputo arranca de una fecha estimada del paso anterior; se recalculará cuando esa fecha sea real.';

export function planificarPasos(
  pasos: PasoPlantilla[],
  fechaApertura: FechaCivil,
  calendario: CalendarioAplicable,
): PasoPlanificado[] {
  const plan: PasoPlanificado[] = [];

  let anterior = fechaApertura;
  let baseEstimada = false;

  for (const paso of [...pasos].sort((a, b) => a.orden - b.orden)) {
    const inicio = anterior;

    if (paso.plazoCantidad && paso.plazoComputo) {
      const resultado = calcularVencimiento({
        fechaInicio: inicio,
        cantidad: paso.plazoCantidad,
        computo: paso.plazoComputo as Computo,
        calendario,
        fundamento: paso.plazoFundamento ?? paso.nombre,
      });

      const advertencias = baseEstimada
        ? [...resultado.advertencias, AVISO_ESTIMADA]
        : resultado.advertencias;

      plan.push({
        orden: paso.orden,
        inicio,
        plazo: {
          resultado,
          cantidad: paso.plazoCantidad,
          computo: paso.plazoComputo as Computo,
          fundamento: paso.plazoFundamento ?? paso.nombre,
          esPreclusivo: paso.plazoEsPreclusivo ?? false,
          completo: resultado.completo && !baseEstimada,
          advertencias,
        },
        fechaPrevista: resultado.vencimiento,
        estimada: baseEstimada,
      });

      // The next step cannot start before this one is due. Filing early moves
      // it earlier; that is what recording the real date is for.
      anterior = resultado.vencimiento;
      continue;
    }

    if (paso.desplazamientoDias !== null && paso.desplazamientoDias !== undefined) {
      const fecha = sumarDias(inicio, paso.desplazamientoDias);

      plan.push({
        orden: paso.orden,
        inicio,
        plazo: undefined,
        fechaPrevista: fecha,
        estimada: baseEstimada,
      });

      anterior = fecha;
      // A zero offset is the anchoring event itself — the notification that
      // opened the file — and is as real as the opening date. Any other offset
      // is somebody's guess about how long an administration will take.
      if (paso.desplazamientoDias !== 0) baseEstimada = true;
      continue;
    }

    plan.push({ orden: paso.orden, inicio, plazo: undefined, estimada: baseEstimada });
  }

  return plan;
}
