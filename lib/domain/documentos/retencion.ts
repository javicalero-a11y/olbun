/**
 * How long a document is kept, and when it may go (SPEC §4.6, M9).
 *
 * Two obligations pull in opposite directions and both are real. Public-sector
 * contracting law says keep the file — six years for the economic paperwork,
 * ten for the contract and what came out of it, indefinitely for a sentencia.
 * The RGPD says do not keep personal data longer than necessary. The retention
 * policy is where those two meet, and the answer is a date, not a preference.
 *
 * Three rules the whole module is built around:
 *
 * 1. **A litigation hold beats everything.** While a document is evidence in a
 *    live dispute it does not expire, no matter what the policy says. Deleting
 *    it would be the worst thing this software could help anybody do.
 * 2. **No policy is not the same as keep forever.** A document whose type has
 *    no `retencionAnios` is reported as unclassified, so somebody decides —
 *    rather than sitting in a purge list because null sorted as zero.
 * 3. **Expiry proposes; a person disposes.** Nothing here deletes. It says what
 *    has come due, and a human with `documento:delete` confirms.
 */

/** The retention clock, expressed as the state of one document today. */
export type EstadoRetencion =
  /** Under a litigation hold: does not expire while the hold stands. */
  | 'BLOQUEADO'
  /** The type carries no retention period, so nobody has decided yet. */
  | 'SIN_POLITICA'
  /** Kept indefinitely on purpose — a sentencia, for instance. */
  | 'PERMANENTE'
  /** Still inside its period. */
  | 'EN_PLAZO'
  /** Inside its period but close enough to warn about. */
  | 'POR_CADUCAR'
  /** The period has run: it may be purged, once a person says so. */
  | 'CADUCADO';

export interface EntradaRetencion {
  /**
   * When the clock starts. The service passes the contract's end date where
   * there is one and the document's own date otherwise — retention runs from
   * the end of the relationship the paperwork documents, not from the day
   * somebody happened to upload the file.
   */
  inicio: Date;
  /** From the document type. Null = no policy, 0 = keep permanently. */
  retencionAnios: number | null;
  bloqueadoPorLitigio: boolean;
  hoy: Date;
}

export interface Retencion {
  estado: EstadoRetencion;
  /** Null when there is no policy, or when the document is kept permanently. */
  caducaEl: Date | null;
  /** Negative once expired. Null when there is no date to count to. */
  diasRestantes: number | null;
  purgable: boolean;
}

/** Warned about this far out, so a purge is never a surprise. */
export const DIAS_DE_AVISO = 90;

const MILISEGUNDOS_POR_DIA = 86_400_000;

/**
 * Adds whole years, clamping 29 February to 28 February in a common year.
 *
 * `setFullYear` would roll it to 1 March, which puts the expiry a day later
 * than the law allows. Erring towards keeping data is the wrong direction when
 * the obligation is to delete it.
 */
export function sumarAnios(fecha: Date, anios: number): Date {
  const resultado = new Date(
    Date.UTC(
      fecha.getUTCFullYear() + anios,
      fecha.getUTCMonth(),
      fecha.getUTCDate(),
      fecha.getUTCHours(),
      fecha.getUTCMinutes(),
      fecha.getUTCSeconds(),
      fecha.getUTCMilliseconds(),
    ),
  );

  if (resultado.getUTCMonth() !== fecha.getUTCMonth()) {
    resultado.setUTCDate(0);
  }

  return resultado;
}

function diasEntre(desde: Date, hasta: Date): number {
  const inicio = Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth(), desde.getUTCDate());
  const fin = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate());

  return Math.round((fin - inicio) / MILISEGUNDOS_POR_DIA);
}

export function evaluarRetencion(entrada: EntradaRetencion): Retencion {
  const { inicio, retencionAnios, bloqueadoPorLitigio, hoy } = entrada;

  // Checked first and returned first: a hold is not a modifier on the other
  // states, it replaces them. A document on hold is never purgable, and the
  // screen should say why rather than showing a date it will not honour.
  if (bloqueadoPorLitigio) {
    return { estado: 'BLOQUEADO', caducaEl: null, diasRestantes: null, purgable: false };
  }

  if (retencionAnios === null) {
    return { estado: 'SIN_POLITICA', caducaEl: null, diasRestantes: null, purgable: false };
  }

  if (retencionAnios <= 0) {
    return { estado: 'PERMANENTE', caducaEl: null, diasRestantes: null, purgable: false };
  }

  const caducaEl = sumarAnios(inicio, retencionAnios);
  const diasRestantes = diasEntre(hoy, caducaEl);

  // Expiry is inclusive of the day itself: a six-year period that started on 1
  // March 2020 is still running on 1 March 2026 and over on the 2nd.
  if (diasRestantes <= 0) {
    return { estado: 'CADUCADO', caducaEl, diasRestantes, purgable: true };
  }

  return {
    estado: diasRestantes <= DIAS_DE_AVISO ? 'POR_CADUCAR' : 'EN_PLAZO',
    caducaEl,
    diasRestantes,
    purgable: false,
  };
}

export const ETIQUETAS_RETENCION: Readonly<Record<EstadoRetencion, string>> = {
  BLOQUEADO: 'Bloqueado por litigio',
  SIN_POLITICA: 'Sin política',
  PERMANENTE: 'Conservación permanente',
  EN_PLAZO: 'En plazo',
  POR_CADUCAR: 'Por caducar',
  CADUCADO: 'Caducado',
};

/** What the screen says next to the state, so the date is never bare. */
export function explicarRetencion(retencion: Retencion): string {
  switch (retencion.estado) {
    case 'BLOQUEADO':
      return 'No se puede borrar mientras el litigio siga abierto, diga lo que diga la política.';
    case 'SIN_POLITICA':
      return 'Su tipo documental no tiene plazo de conservación asignado. Nadie ha decidido todavía.';
    case 'PERMANENTE':
      return 'Se conserva indefinidamente.';
    case 'POR_CADUCAR':
      return `Caduca en ${String(retencion.diasRestantes ?? 0)} días.`;
    case 'CADUCADO':
      return `Caducó hace ${String(Math.abs(retencion.diasRestantes ?? 0))} días. Puede purgarse.`;
    case 'EN_PLAZO':
      return `Quedan ${String(retencion.diasRestantes ?? 0)} días de conservación.`;
  }
}
