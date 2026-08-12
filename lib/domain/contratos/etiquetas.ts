import type {
  EstadoContrato,
  ProcedimientoAdjudicacion,
  TipoContrato,
  TipoPoderAdjudicador,
} from '@prisma/client';

/** Human labels. Raw enum names must never reach a screen. */

export const ETIQUETA_TIPO_PODER: Readonly<Record<TipoPoderAdjudicador, string>> = {
  AYUNTAMIENTO: 'Ayuntamiento',
  DIPUTACION: 'Diputación',
  CABILDO_CONSELL: 'Cabildo o Consell insular',
  COMUNIDAD_AUTONOMA: 'Comunidad autónoma',
  ADMINISTRACION_GENERAL_ESTADO: 'Administración General del Estado',
  ORGANISMO_AUTONOMO: 'Organismo autónomo',
  ENTIDAD_PUBLICA_EMPRESARIAL: 'Entidad pública empresarial',
  SERVICIO_SALUD: 'Servicio de salud',
  UNIVERSIDAD: 'Universidad',
  CONSORCIO: 'Consorcio',
  MANCOMUNIDAD: 'Mancomunidad',
  EMPRESA_PUBLICA: 'Empresa pública',
  OTRO: 'Otro',
};

export const ETIQUETA_TIPO_CONTRATO: Readonly<Record<TipoContrato, string>> = {
  SERVICIOS: 'Servicios',
  OBRAS: 'Obras',
  SUMINISTROS: 'Suministros',
  CONCESION_SERVICIOS: 'Concesión de servicios',
  CONCESION_OBRAS: 'Concesión de obras',
  MIXTO: 'Mixto',
  PRIVADO: 'Privado',
};

export const ETIQUETA_PROCEDIMIENTO: Readonly<Record<ProcedimientoAdjudicacion, string>> = {
  ABIERTO: 'Abierto',
  ABIERTO_SIMPLIFICADO: 'Abierto simplificado',
  ABIERTO_SIMPLIFICADO_ABREVIADO: 'Abierto simplificado abreviado',
  RESTRINGIDO: 'Restringido',
  NEGOCIADO_SIN_PUBLICIDAD: 'Negociado sin publicidad',
  LICITACION_CON_NEGOCIACION: 'Licitación con negociación',
  DIALOGO_COMPETITIVO: 'Diálogo competitivo',
  ASOCIACION_INNOVACION: 'Asociación para la innovación',
  CONTRATO_MENOR: 'Contrato menor',
  ACUERDO_MARCO: 'Acuerdo marco',
  SISTEMA_DINAMICO: 'Sistema dinámico de adquisición',
  ENCARGO_MEDIO_PROPIO: 'Encargo a medio propio',
};

export const ETIQUETA_ESTADO_CONTRATO: Readonly<
  Record<EstadoContrato, { texto: string; clase: string }>
> = {
  LICITACION: { texto: 'En licitación', clase: 'text-status-neutral' },
  ADJUDICADO: { texto: 'Adjudicado', clase: 'text-status-info' },
  FORMALIZADO: { texto: 'Formalizado', clase: 'text-status-info' },
  EN_EJECUCION: { texto: 'En ejecución', clase: 'text-status-green' },
  PRORROGADO: { texto: 'Prorrogado', clase: 'text-status-green' },
  SUSPENDIDO: { texto: 'Suspendido', clase: 'text-status-amber' },
  EN_LIQUIDACION: { texto: 'En liquidación', clase: 'text-status-amber' },
  FINALIZADO: { texto: 'Finalizado', clase: 'text-status-neutral' },
  RESUELTO: { texto: 'Resuelto', clase: 'text-status-red' },
  PERDIDO: { texto: 'Perdido', clase: 'text-status-neutral' },
};

/** Formats an amount in euros, or a dash when unknown. */
export function formatearEuros(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(valor);
}
