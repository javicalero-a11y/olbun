/**
 * Spanish labels for the expediente enums.
 *
 * Kept out of the components so the same wording appears in a list, a detail
 * page, an email and a CSV export without three people paraphrasing it.
 */

export const ETIQUETA_TIPO_EXPEDIENTE: Record<string, string> = {
  PENALIDAD: 'Penalidad',
  EXPEDIENTE_SANCIONADOR: 'Expediente sancionador',
  RESOLUCION_CONTRATO: 'Resolución de contrato',
  MODIFICADO: 'Modificado',
  REEQUILIBRIO_ECONOMICO: 'Reequilibrio económico',
  REVISION_PRECIOS: 'Revisión de precios',
  LIQUIDACION: 'Liquidación',
  DEVOLUCION_GARANTIA: 'Devolución de garantía',
  IMPAGO_MOROSIDAD: 'Impago y morosidad',
  RECURSO_ESPECIAL_CONTRATACION: 'Recurso especial en contratación',
  RECURSO_ALZADA: 'Recurso de alzada',
  RECURSO_REPOSICION: 'Recurso de reposición',
  RECURSO_CONTENCIOSO: 'Recurso contencioso-administrativo',
  SUBROGACION: 'Subrogación de personal',
  DESPIDO: 'Despido',
  RECLAMACION_CANTIDAD: 'Reclamación de cantidad',
  CONFLICTO_COLECTIVO: 'Conflicto colectivo',
  SANCION_ITSS: 'Sanción de la Inspección de Trabajo',
  RESPONSABILIDAD_PATRIMONIAL: 'Responsabilidad patrimonial',
  RECLAMACION_TERCERO: 'Reclamación de tercero',
};

export const ETIQUETA_JURISDICCION: Record<string, string> = {
  ADMINISTRATIVA: 'Vía administrativa',
  CONTENCIOSO_ADMINISTRATIVA: 'Contencioso-administrativa',
  SOCIAL: 'Social',
  CIVIL: 'Civil',
  PENAL: 'Penal',
  ARBITRAJE: 'Arbitraje',
  EXTRAJUDICIAL: 'Extrajudicial',
};

export const ETIQUETA_ESTADO_EXPEDIENTE: Record<string, { texto: string; clase: string }> = {
  BORRADOR: { texto: 'Borrador', clase: 'text-muted-foreground' },
  ABIERTO: { texto: 'Abierto', clase: 'text-foreground' },
  EN_TRAMITE: { texto: 'En trámite', clase: 'text-foreground' },
  SUSPENDIDO: { texto: 'Suspendido', clase: 'text-status-amber' },
  PENDIENTE_RESOLUCION: { texto: 'Pendiente de resolución', clase: 'text-status-amber' },
  RESUELTO: { texto: 'Resuelto', clase: 'text-status-green' },
  RECURRIDO: { texto: 'Recurrido', clase: 'text-status-amber' },
  ARCHIVADO: { texto: 'Archivado', clase: 'text-muted-foreground' },
};

export const ETIQUETA_TIPO_HITO: Record<string, string> = {
  RECEPCION_NOTIFICACION: 'Notificación recibida',
  PRESENTACION_ESCRITO: 'Escrito a presentar',
  PRUEBA: 'Prueba',
  VISTA_JUICIO: 'Vista o juicio',
  RESOLUCION: 'Resolución',
  PAGO: 'Pago',
  ACTUACION_INTERNA: 'Actuación interna',
};

export const ETIQUETA_ESTADO_HITO: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  CUMPLIDO: 'Cumplido',
  VENCIDO: 'Vencido',
  NO_APLICA: 'No aplica',
};

export const ETIQUETA_COMPUTO: Record<string, string> = {
  HABILES_ADMINISTRATIVO: 'días hábiles administrativos',
  HABILES_JUDICIAL: 'días hábiles judiciales',
  NATURALES: 'días naturales',
  MESES: 'meses',
  ANOS: 'años',
};

export const ETIQUETA_SENTIDO: Record<string, string> = {
  ESTIMATORIA_TOTAL: 'Estimatoria total',
  ESTIMATORIA_PARCIAL: 'Estimatoria parcial',
  DESESTIMATORIA: 'Desestimatoria',
  ALLANAMIENTO: 'Allanamiento',
  DESISTIMIENTO: 'Desistimiento',
  ACUERDO: 'Acuerdo',
  CADUCIDAD: 'Caducidad',
  INADMISION: 'Inadmisión',
};

/**
 * Chance of success, on the scale accounting provisions already use, so the
 * same word means the same thing to the legal team and to finance.
 */
export const ETIQUETA_PROBABILIDAD: Record<string, string> = {
  ALTA: 'Alta — probable que prospere',
  MEDIA: 'Media — resultado incierto',
  BAJA: 'Baja — improbable que prospere',
  REMOTA: 'Remota',
};

/** How a deadline was computed, in words: "10 días hábiles administrativos". */
export function describirComputo(cantidad: number, computo: string): string {
  const unidad = ETIQUETA_COMPUTO[computo] ?? computo;
  if (cantidad === 1) {
    // "1 meses" reads as a bug even when the number is right.
    const singular: Record<string, string> = {
      MESES: 'mes',
      ANOS: 'año',
      NATURALES: 'día natural',
      HABILES_ADMINISTRATIVO: 'día hábil administrativo',
      HABILES_JUDICIAL: 'día hábil judicial',
    };
    return `1 ${singular[computo] ?? unidad}`;
  }
  return `${String(cantidad)} ${unidad}`;
}
