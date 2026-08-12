import { diferenciaEnDias, formatearEs, sumarDias, type FechaCivil } from '../fecha';

/**
 * Contract renewal and expiry warnings (SPEC §6.5).
 *
 * Pure. The decision that matters commercially is not when a contract ends —
 * it is the last day on which the authority can still be told you want the
 * extension. Miss the preaviso and the contract lapses regardless of how well
 * the service was delivered.
 */

export type NivelAviso = 'CRITICO' | 'ALTO' | 'MEDIO' | 'INFORMATIVO';

export interface AvisoContrato {
  nivel: NivelAviso;
  titulo: string;
  detalle: string;
  /** Days from today. Negative means already passed. */
  diasRestantes: number;
  fecha: FechaCivil;
}

export interface DatosAvisoContrato {
  fechaFinPrevista?: FechaCivil | undefined;
  preavisoProrrogaDias?: number | undefined;
  estado: string;
}

/** Thresholds at which a renewal decision stops being comfortable. */
const UMBRALES: { dias: number; nivel: NivelAviso }[] = [
  { dias: 30, nivel: 'CRITICO' },
  { dias: 60, nivel: 'ALTO' },
  { dias: 90, nivel: 'MEDIO' },
];

function nivelPorDias(dias: number): NivelAviso {
  if (dias < 0) return 'CRITICO';
  for (const umbral of UMBRALES) {
    if (dias <= umbral.dias) return umbral.nivel;
  }
  return 'INFORMATIVO';
}

const ESTADOS_SIN_AVISO = new Set(['FINALIZADO', 'RESUELTO', 'PERDIDO', 'LICITACION']);

export function avisosDeContrato(datos: DatosAvisoContrato, hoy: FechaCivil): AvisoContrato[] {
  if (ESTADOS_SIN_AVISO.has(datos.estado)) return [];
  if (!datos.fechaFinPrevista) return [];

  const avisos: AvisoContrato[] = [];
  const diasHastaFin = diferenciaEnDias(hoy, datos.fechaFinPrevista);

  // The notice deadline comes first in time and matters more: after it, the
  // extension is no longer available even though the contract is still running.
  if (datos.preavisoProrrogaDias && datos.preavisoProrrogaDias > 0) {
    const fechaPreaviso = sumarDias(datos.fechaFinPrevista, -datos.preavisoProrrogaDias);
    const diasHastaPreaviso = diferenciaEnDias(hoy, fechaPreaviso);

    avisos.push({
      nivel: nivelPorDias(diasHastaPreaviso),
      titulo:
        diasHastaPreaviso < 0
          ? 'Plazo de preaviso de prórroga vencido'
          : 'Preaviso de prórroga',
      detalle:
        diasHastaPreaviso < 0
          ? `El preaviso venció el ${formatearEs(fechaPreaviso)}. La prórroga puede haberse perdido.`
          : `Último día para comunicar la prórroga: ${formatearEs(fechaPreaviso)}.`,
      diasRestantes: diasHastaPreaviso,
      fecha: fechaPreaviso,
    });
  }

  avisos.push({
    nivel: nivelPorDias(diasHastaFin),
    titulo: diasHastaFin < 0 ? 'Contrato vencido' : 'Fin de contrato',
    detalle:
      diasHastaFin < 0
        ? `Finalizó el ${formatearEs(datos.fechaFinPrevista)} y sigue marcado como activo.`
        : `Finaliza el ${formatearEs(datos.fechaFinPrevista)}.`,
    diasRestantes: diasHastaFin,
    fecha: datos.fechaFinPrevista,
  });

  return avisos.sort((a, b) => a.diasRestantes - b.diasRestantes);
}

/** The single most urgent warning, for a list row. */
export function avisoMasUrgente(
  datos: DatosAvisoContrato,
  hoy: FechaCivil,
): AvisoContrato | undefined {
  const avisos = avisosDeContrato(datos, hoy).filter((a) => a.nivel !== 'INFORMATIVO');
  return avisos[0];
}
