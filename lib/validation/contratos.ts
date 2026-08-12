import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';

/**
 * Validation for contracting authorities and contracts. Messages are
 * user-facing, so Spanish.
 */

/** Accepts a civil date (YYYY-MM-DD) or an empty field. */
export const fechaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' ? undefined : v))
  .refine((v) => v === undefined || esFechaCivil(v), 'Fecha no válida');

/** Money as typed by a person: "1.234.567,89" or "1234567.89". */
export const importeOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => {
    if (!v) return undefined;
    const normalizado = v
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');
    return normalizado === '' ? undefined : Number(normalizado);
  })
  .refine(
    (v) => v === undefined || (Number.isFinite(v) && v >= 0),
    'Introduce un importe válido',
  );

export const enteroOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === '' || v === undefined ? undefined : Number(v)))
  .refine(
    (v) => v === undefined || (Number.isInteger(v) && v >= 0),
    'Introduce un número entero',
  );

export const TIPOS_PODER = [
  'AYUNTAMIENTO',
  'DIPUTACION',
  'CABILDO_CONSELL',
  'COMUNIDAD_AUTONOMA',
  'ADMINISTRACION_GENERAL_ESTADO',
  'ORGANISMO_AUTONOMO',
  'ENTIDAD_PUBLICA_EMPRESARIAL',
  'SERVICIO_SALUD',
  'UNIVERSIDAD',
  'CONSORCIO',
  'MANCOMUNIDAD',
  'EMPRESA_PUBLICA',
  'OTRO',
] as const;

export const poderAdjudicadorSchema = z.object({
  nombre: z.string().trim().min(2, 'Introduce el nombre del órgano').max(200),
  tipo: z.enum(TIPOS_PODER),
  nif: z.string().trim().max(20).optional(),
  codigoDir3: z.string().trim().max(30).optional(),
  comunidadAutonoma: z.string().trim().max(80).optional(),
  provincia: z.string().trim().max(80).optional(),
  municipioNombre: z.string().trim().max(120).optional(),
  municipioIne: z.string().trim().max(10).optional(),
  sedeElectronicaUrl: z.union([z.url('Dirección no válida'), z.literal('')]).optional(),
  perfilContratanteUrl: z.union([z.url('Dirección no válida'), z.literal('')]).optional(),
  notas: z.string().trim().max(2000).optional(),
});

export type PoderAdjudicadorInput = z.infer<typeof poderAdjudicadorSchema>;

export const TIPOS_CONTRATO = [
  'SERVICIOS',
  'OBRAS',
  'SUMINISTROS',
  'CONCESION_SERVICIOS',
  'CONCESION_OBRAS',
  'MIXTO',
  'PRIVADO',
] as const;

export const PROCEDIMIENTOS = [
  'ABIERTO',
  'ABIERTO_SIMPLIFICADO',
  'ABIERTO_SIMPLIFICADO_ABREVIADO',
  'RESTRINGIDO',
  'NEGOCIADO_SIN_PUBLICIDAD',
  'LICITACION_CON_NEGOCIACION',
  'DIALOGO_COMPETITIVO',
  'ASOCIACION_INNOVACION',
  'CONTRATO_MENOR',
  'ACUERDO_MARCO',
  'SISTEMA_DINAMICO',
  'ENCARGO_MEDIO_PROPIO',
] as const;

export const ESTADOS_CONTRATO = [
  'LICITACION',
  'ADJUDICADO',
  'FORMALIZADO',
  'EN_EJECUCION',
  'PRORROGADO',
  'SUSPENDIDO',
  'EN_LIQUIDACION',
  'FINALIZADO',
  'RESUELTO',
  'PERDIDO',
] as const;

export const contratoSchema = z
  .object({
    numeroExpediente: z
      .string()
      .trim()
      .min(1, 'Introduce el número de expediente del órgano')
      .max(80),
    objeto: z.string().trim().min(3, 'Describe el objeto del contrato').max(500),
    descripcion: z.string().trim().max(4000).optional(),
    poderAdjudicadorId: z.string().min(1, 'Selecciona el órgano de contratación'),
    tipo: z.enum(TIPOS_CONTRATO),
    procedimiento: z.enum(PROCEDIMIENTOS),
    estado: z.enum(ESTADOS_CONTRATO),
    lote: z.string().trim().max(40).optional(),
    fechaFormalizacion: fechaOpcional,
    fechaInicio: fechaOpcional,
    duracionInicialMeses: enteroOpcional,
    fechaFinPrevista: fechaOpcional,
    preavisoProrrogaDias: enteroOpcional,
    importeAdjudicacion: importeOpcional,
    haySubrogacionPersonal: z.coerce.boolean().optional(),
    hayRevisionPrecios: z.coerce.boolean().optional(),
    plazoGarantiaMeses: enteroOpcional,
  })
  .refine(
    (datos) =>
      !datos.fechaInicio ||
      !datos.fechaFinPrevista ||
      datos.fechaInicio <= datos.fechaFinPrevista,
    { message: 'La fecha de fin no puede ser anterior al inicio', path: ['fechaFinPrevista'] },
  );

export type ContratoInput = z.infer<typeof contratoSchema>;
