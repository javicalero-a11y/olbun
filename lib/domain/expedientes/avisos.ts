import { diferenciaEnDias, type FechaCivil } from '@/lib/domain/fecha';

/**
 * How loudly a deadline should shout.
 *
 * Two things decide it, and only two: how many days are left, and whether
 * missing it forfeits the right (preclusivo). A preclusive deadline is graded
 * far more harshly than an ordinary one, because there is no remedy afterwards
 * — this is the whole reason the product exists.
 *
 * A third factor never softens the grade: if the calculation rested on an
 * unverified calendar, the warning carries that caveat *in addition*, never
 * instead. An uncertain date is more dangerous than a certain one, not less.
 */

export type NivelPlazo = 'VENCIDO' | 'CRITICO' | 'ALTO' | 'MEDIO' | 'INFORMATIVO' | 'CERRADO';

export interface PlazoEvaluable {
  id: string;
  descripcion: string;
  fundamento: string;
  cantidad: number;
  computo: string;
  fechaInicio: FechaCivil;
  fechaVencimientoCalculada: FechaCivil;
  fechaVencimientoConfirmada?: FechaCivil | undefined;
  esPreclusivo: boolean;
  calculoCompleto: boolean;
  advertencias: string[];
  estado: string;
}

export interface AvisoPlazo {
  plazoId: string;
  nivel: NivelPlazo;
  /** The date actually being counted down to. */
  vencimiento: FechaCivil;
  diasRestantes: number;
  /** True while no person has confirmed the computed date. */
  provisional: boolean;
  titulo: string;
  detalle: string;
}

const ORDEN: Record<NivelPlazo, number> = {
  VENCIDO: 0,
  CRITICO: 1,
  ALTO: 2,
  MEDIO: 3,
  INFORMATIVO: 4,
  CERRADO: 5,
};

/**
 * The confirmed date wins when it exists: a person who has checked the
 * calculation against the notification overrules the engine, always.
 */
export function vencimientoEfectivo(plazo: PlazoEvaluable): FechaCivil {
  return plazo.fechaVencimientoConfirmada ?? plazo.fechaVencimientoCalculada;
}

function nivelPara(dias: number, esPreclusivo: boolean): NivelPlazo {
  if (dias < 0) return 'VENCIDO';
  if (esPreclusivo) {
    // Deliberately alarmist. Three days before losing a right to appeal is
    // not a "medium" situation for anyone.
    if (dias <= 3) return 'CRITICO';
    if (dias <= 10) return 'ALTO';
    if (dias <= 30) return 'MEDIO';
    return 'INFORMATIVO';
  }
  if (dias <= 2) return 'CRITICO';
  if (dias <= 7) return 'ALTO';
  if (dias <= 15) return 'MEDIO';
  return 'INFORMATIVO';
}

export function evaluarPlazo(plazo: PlazoEvaluable, hoy: FechaCivil): AvisoPlazo {
  const vencimiento = vencimientoEfectivo(plazo);
  const diasRestantes = diferenciaEnDias(hoy, vencimiento);
  const provisional = plazo.fechaVencimientoConfirmada === undefined;

  // A deadline already met or lifted is not a warning, whatever the date says.
  const cerrado =
    plazo.estado === 'CUMPLIDO' || plazo.estado === 'SUSPENDIDO' || plazo.estado === 'AMPLIADO';

  const nivel: NivelPlazo = cerrado ? 'CERRADO' : nivelPara(diasRestantes, plazo.esPreclusivo);

  const partes: string[] = [plazo.fundamento];
  if (plazo.esPreclusivo && !cerrado) {
    partes.push('Plazo preclusivo: si se pasa, se pierde el derecho.');
  }
  if (!plazo.calculoCompleto) {
    partes.push(
      'Fecha calculada sobre calendarios sin verificar — compruébala antes de actuar.',
    );
  } else if (provisional && !cerrado) {
    partes.push('Fecha calculada, pendiente de confirmación.');
  }
  for (const advertencia of plazo.advertencias) partes.push(advertencia);

  return {
    plazoId: plazo.id,
    nivel,
    vencimiento,
    diasRestantes,
    provisional,
    titulo: plazo.descripcion,
    detalle: partes.join(' '),
  };
}

/** Warnings for a set of deadlines, most urgent first. */
export function avisosDePlazos(plazos: PlazoEvaluable[], hoy: FechaCivil): AvisoPlazo[] {
  return plazos
    .map((plazo) => evaluarPlazo(plazo, hoy))
    .sort((a, b) => {
      const porNivel = ORDEN[a.nivel] - ORDEN[b.nivel];
      if (porNivel !== 0) return porNivel;
      // Ascending days serves both ends: among live deadlines the soonest is
      // the one to act on, and among overdue ones (negative) the oldest breach
      // — the biggest problem — comes first.
      return a.diasRestantes - b.diasRestantes;
    });
}

/** The single warning to show next to an expediente in a list. */
export function avisoMasUrgente(
  plazos: PlazoEvaluable[],
  hoy: FechaCivil,
): AvisoPlazo | undefined {
  const avisos = avisosDePlazos(plazos, hoy).filter((a) => a.nivel !== 'CERRADO');
  return avisos[0];
}
