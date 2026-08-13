import type { Jurisdiccion, TipoDeteccion, TipoExpediente } from '@prisma/client';

/**
 * The catalogue of things worth spotting in correspondence (SPEC §4.4).
 *
 * Each entry answers three questions a reviewer has: what is this, how bad is
 * it, and what happens if I say yes. Keeping all three in one table means the
 * queue ordering, the confirmation dialog and the prompt cannot drift apart —
 * the prompt is generated from this file, so a type added here is a type the
 * engine is told about.
 */

/** What confirming a detection produces. */
export type DestinoConfirmacion =
  /** Opens an expediente from its procedure template (SPEC §4.5). */
  | 'EXPEDIENTE'
  /** Becomes an incidencia or a risk — both arrive with M10. */
  | 'INCIDENCIA'
  | 'RIESGO'
  /**
   * Nothing is created. A mentioned deadline is recorded as reviewed and a
   * person decides where it belongs, because a date in an email is not a
   * `Plazo` until somebody has checked its legal basis (SPEC §6.4).
   */
  | 'NINGUNO';

export interface DefinicionTipo {
  /** Short label for the queue. */
  etiqueta: string;
  /** One line telling a reviewer what the engine thinks it found. */
  descripcion: string;
  /**
   * 0–1. How much a true instance of this costs if nobody sees it — not how
   * likely it is. The queue sorts on `confianza × gravedad`, so a probable
   * trifle stays below an uncertain threat to the contract.
   */
  gravedad: number;
  destino: DestinoConfirmacion;
  /**
   * For `EXPEDIENTE`, what to open. Typed against the schema's own enums so a
   * mapping to a kind of expediente that does not exist fails to compile.
   */
  expediente?: { tipo: TipoExpediente; jurisdiccion: Jurisdiccion };
  /** What the engine should look for. Goes into the prompt verbatim. */
  senales: string;
}

export const TIPOS_DETECCION: Readonly<Record<TipoDeteccion, DefinicionTipo>> = {
  INICIO_EXPEDIENTE_SANCIONADOR: {
    etiqueta: 'Inicio de expediente sancionador',
    descripcion: 'La administración ha abierto un procedimiento sancionador contra la empresa.',
    gravedad: 1,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'EXPEDIENTE_SANCIONADOR', jurisdiccion: 'ADMINISTRATIVA' },
    senales:
      'acuerdo de incoación, inicio de expediente sancionador, nombramiento de instructor, pliego de cargos',
  },
  AMENAZA_RESOLUCION: {
    etiqueta: 'Amenaza de resolución',
    descripcion: 'Se anuncia o se inicia la resolución del contrato.',
    gravedad: 1,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'RESOLUCION_CONTRATO', jurisdiccion: 'ADMINISTRATIVA' },
    senales:
      'resolución del contrato, causa de resolución, incautación de la garantía, apercibimiento de resolución',
  },
  PREAVISO_PENALIDAD: {
    etiqueta: 'Preaviso de penalidad',
    descripcion: 'Se propone o se anuncia una penalidad por incumplimiento.',
    gravedad: 0.9,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'PENALIDAD', jurisdiccion: 'ADMINISTRATIVA' },
    senales:
      'propuesta de penalidad, imposición de penalidades, descuento en la certificación por penalidad',
  },
  REQUERIMIENTO_FORMAL: {
    etiqueta: 'Requerimiento formal',
    descripcion: 'Se requiere una actuación o una respuesta en un plazo determinado.',
    gravedad: 0.8,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'EXPEDIENTE_SANCIONADOR', jurisdiccion: 'ADMINISTRATIVA' },
    senales:
      'se requiere a la empresa, deberá subsanar, en el plazo de … días, con advertencia de, trámite de audiencia',
  },
  ASUNTO_LABORAL: {
    etiqueta: 'Asunto laboral',
    descripcion: 'Demanda, papeleta de conciliación, acta de la Inspección o sanción laboral.',
    gravedad: 0.85,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'RECLAMACION_CANTIDAD', jurisdiccion: 'SOCIAL' },
    senales:
      'papeleta de conciliación, SMAC, demanda ante el juzgado de lo social, acta de infracción, Inspección de Trabajo',
  },
  SUBROGACION: {
    etiqueta: 'Subrogación',
    descripcion: 'Se comunica o se discute la subrogación de personal.',
    gravedad: 0.7,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'SUBROGACION', jurisdiccion: 'SOCIAL' },
    senales: 'listado de subrogación, personal a subrogar, sucesión de empresa, artículo 44 ET',
  },
  IMPAGO_FACTURA: {
    etiqueta: 'Impago de factura',
    descripcion: 'Una factura conformada sigue sin pagarse, o se discute su pago.',
    gravedad: 0.6,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'IMPAGO_MOROSIDAD', jurisdiccion: 'ADMINISTRATIVA' },
    senales:
      'factura pendiente de pago, reclamación de intereses de demora, periodo medio de pago, factura devuelta',
  },
  SOLICITUD_MODIFICADO: {
    etiqueta: 'Solicitud de modificado',
    descripcion: 'Se plantea modificar el contrato o su alcance.',
    gravedad: 0.5,
    destino: 'EXPEDIENTE',
    expediente: { tipo: 'MODIFICADO', jurisdiccion: 'ADMINISTRATIVA' },
    senales:
      'modificación del contrato, ampliación del objeto, modificado, incremento de prestaciones',
  },
  SINIESTRO: {
    etiqueta: 'Siniestro',
    descripcion: 'Daño a un tercero o a bienes, con posible reclamación al seguro.',
    gravedad: 0.6,
    destino: 'EXPEDIENTE',
    // SPEC lists SINIESTRO among the third-party types; the schema's nearest
    // term of art is a third-party claim, which is what a siniestro becomes the
    // moment somebody asks us to pay for it.
    expediente: { tipo: 'RECLAMACION_TERCERO', jurisdiccion: 'CIVIL' },
    senales: 'daños causados, parte de siniestro, reclamación patrimonial, póliza de seguro',
  },
  INCUMPLIMIENTO_ALEGADO: {
    etiqueta: 'Incumplimiento alegado',
    descripcion: 'Se afirma que el servicio no cumple lo pactado, sin abrir aún expediente.',
    gravedad: 0.55,
    destino: 'INCIDENCIA',
    senales:
      'incumplimiento del pliego, no se ha prestado el servicio, deficiencias reiteradas, falta de personal',
  },
  QUEJA_FORMAL: {
    etiqueta: 'Queja formal',
    descripcion: 'Queja registrada por el poder adjudicador o por un centro.',
    gravedad: 0.4,
    destino: 'INCIDENCIA',
    senales: 'queja formal, escrito de queja, reiteramos la queja, registro de entrada',
  },
  RECLAMACION_USUARIO: {
    etiqueta: 'Reclamación de usuario',
    descripcion: 'Un usuario del servicio reclama por el trato o la prestación.',
    gravedad: 0.35,
    destino: 'INCIDENCIA',
    senales:
      'hoja de reclamaciones, usuario del servicio, reclamación del residente o del familiar',
  },
  RIESGO_PRL: {
    etiqueta: 'Riesgo de prevención',
    descripcion: 'Se señala un riesgo laboral, un accidente o un incumplimiento de PRL.',
    gravedad: 0.75,
    destino: 'RIESGO',
    senales:
      'riesgo grave e inminente, accidente de trabajo, evaluación de riesgos, coordinación de actividades empresariales',
  },
  PLAZO_MENCIONADO: {
    etiqueta: 'Plazo mencionado',
    descripcion:
      'Se cita un plazo. Nunca crea un plazo por sí solo: hay que comprobar en qué se funda.',
    gravedad: 0.65,
    destino: 'NINGUNO',
    senales:
      'en el plazo de … días hábiles, dispone de … días naturales, antes del día …, con carácter improrrogable',
  },
};

/**
 * Queue ordering (SPEC §5.4).
 *
 * Confidence alone would put a certain complaint above an uncertain notice of
 * contract resolution, which is precisely backwards: the reviewer's scarce
 * attention should go where being wrong costs most.
 */
export function prioridad(tipo: TipoDeteccion, confianza: number): number {
  return confianza * (TIPOS_DETECCION[tipo]?.gravedad ?? 0.5);
}

/**
 * Below this, a detection is real enough to keep but not to interrupt anyone
 * with; it waits in "baja confianza" (SPEC §6.4). Configurable per tenant
 * later; one number in one place until there is a reason for more.
 */
export const UMBRAL_CONFIANZA = 0.6;

export function esBajaConfianza(confianza: number): boolean {
  return confianza < UMBRAL_CONFIANZA;
}

/** The types, most serious first — the order the prompt lists them in. */
export function tiposPorGravedad(): TipoDeteccion[] {
  return (Object.keys(TIPOS_DETECCION) as TipoDeteccion[]).sort(
    (a, b) => (TIPOS_DETECCION[b]?.gravedad ?? 0) - (TIPOS_DETECCION[a]?.gravedad ?? 0),
  );
}
