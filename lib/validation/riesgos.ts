import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';

export const TIPOS_INCIDENCIA = [
  'ACCIDENTE',
  'INCIDENTE_SIN_BAJA',
  'DANO_MATERIAL',
  'FALLO_SERVICIO',
  'QUEJA_USUARIO',
  'AGRESION',
  'MEDIOAMBIENTAL',
  'VEHICULO',
  'SEGURIDAD_DATOS',
] as const;

export const GRAVEDADES_INCIDENCIA = ['LEVE', 'MODERADA', 'GRAVE', 'MUY_GRAVE'] as const;
export const ESTADOS_INCIDENCIA = [
  'ABIERTA',
  'EN_INVESTIGACION',
  'CERRADA',
  'REABIERTA',
] as const;
export const RESPUESTAS_RIESGO = ['EVITAR', 'MITIGAR', 'TRANSFERIR', 'ACEPTAR'] as const;
export const RESULTADOS_REVISION = [
  'SIN_CAMBIOS',
  'REVALORADO',
  'CONTROL_ACTUALIZADO',
  'CERRADO',
] as const;
export const TIPOS_CONTROL = ['PREVENTIVO', 'DETECTIVO', 'CORRECTIVO', 'DIRECTIVO'] as const;
export const EFICACIAS_CONTROL = ['NO_EVALUADO', 'INEFICAZ', 'PARCIAL', 'EFICAZ'] as const;
export const PRIORIDADES_ACCION = ['BAJA', 'MEDIA', 'ALTA', 'URGENTE'] as const;
export const ESTADOS_ACCION = [
  'PENDIENTE',
  'EN_CURSO',
  'BLOQUEADA',
  'COMPLETADA',
  'VERIFICADA',
  'CANCELADA',
] as const;

const fechaCivil = z
  .string()
  .refine((valor) => esFechaCivil(valor), 'Introduce una fecha válida (AAAA-MM-DD).');

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor));

const fechaOpcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor === '' ? undefined : valor))
  .refine((valor) => valor === undefined || esFechaCivil(valor), 'Introduce una fecha válida.');

const escala = z.coerce.number().int().min(1).max(5);
const id = z.string().trim().min(1).max(40);
const casilla = z
  // Acepta las dos formas que llegan: el valor crudo de una casilla HTML
  // («on» marcada, «» o ausente sin marcar) y el booleano que devuelve el
  // ayudante compartido `casilla(formData, campo)`. Aceptar sólo la primera
  // obligaba a cada acción a deshacer la conversión con `? 'on' : ''`, y la
  // que se olvidaba de hacerlo fallaba la validación en silencio.
  .union([z.literal('on'), z.literal(''), z.boolean()])
  .optional()
  .transform((valor) => valor === 'on' || valor === true);

export const incidenciaSchema = z.object({
  tipo: z.enum(TIPOS_INCIDENCIA),
  gravedad: z.enum(GRAVEDADES_INCIDENCIA),
  fechaHecho: fechaCivil,
  descripcion: z
    .string()
    .trim()
    .min(10, 'Cuenta qué pasó: quien lo lea dentro de un año no estaba allí.')
    .max(4000, 'Como mucho 4.000 caracteres.'),
  contratoId: opcional(40),
  lugar: opcional(200),
  medidasInmediatas: opcional(2000),
  esNotificableAAutoridad: casilla,
});

export const actualizarIncidenciaSchema = z.object({
  incidenciaId: id,
  estado: z.enum(ESTADOS_INCIDENCIA),
  causaRaiz: opcional(4000),
  leccionesAprendidas: opcional(4000),
  comunicadaAlOrgano: casilla,
  notificadaAAutoridad: casilla,
  referenciaAutoridad: opcional(200),
});

export const personasImplicadasSchema = z.object({
  incidenciaId: id,
  personasImplicadas: z
    .string()
    .trim()
    .min(3, 'Describe únicamente los datos necesarios para investigar el hecho.')
    .max(4000, 'Como mucho 4.000 caracteres.'),
});

export const riesgoSchema = z.object({
  categoriaId: id,
  causa: z.string().trim().min(3, 'Di qué lo provoca.').max(500),
  evento: z.string().trim().min(3, 'Di qué es lo que puede pasar.').max(500),
  consecuencia: z.string().trim().min(3, 'Di en qué se traduce si pasa.').max(500),
  probabilidadInherente: escala,
  impactoInherente: escala,
  respuesta: z.enum(RESPUESTAS_RIESGO),
  contratoId: opcional(40),
  responsableId: opcional(40),
  frecuenciaRevisionDias: z.coerce.number().int().min(1).max(3650).default(90),
});

export const revisionRiesgoSchema = z
  .object({
    riesgoId: id,
    resultado: z.enum(RESULTADOS_REVISION),
    comentarios: z.string().trim().min(10, 'Documenta qué se ha revisado.').max(4000),
    probabilidadResidual: escala.optional(),
    impactoResidual: escala.optional(),
    proximaRevision: fechaOpcional,
  })
  .superRefine((datos, contexto) => {
    const tieneProbabilidad = datos.probabilidadResidual !== undefined;
    const tieneImpacto = datos.impactoResidual !== undefined;
    if (tieneProbabilidad !== tieneImpacto) {
      contexto.addIssue({
        code: 'custom',
        path: ['probabilidadResidual'],
        message: 'Valora juntos probabilidad e impacto residual.',
      });
    }
    if (datos.resultado === 'REVALORADO' && !tieneProbabilidad) {
      contexto.addIssue({
        code: 'custom',
        path: ['probabilidadResidual'],
        message: 'Una revaloración necesita los dos ejes residuales.',
      });
    }
    if (datos.resultado !== 'CERRADO' && !datos.proximaRevision) {
      contexto.addIssue({
        code: 'custom',
        path: ['proximaRevision'],
        message: 'Programa la siguiente revisión.',
      });
    }
  });

export const controlRiesgoSchema = z.object({
  riesgoId: id,
  titulo: z.string().trim().min(5, 'Pon un nombre reconocible al control.').max(200),
  descripcion: z.string().trim().min(10, 'Explica cómo funciona el control.').max(3000),
  tipo: z.enum(TIPOS_CONTROL),
  eficacia: z.enum(EFICACIAS_CONTROL),
  esExistente: casilla,
  responsableId: opcional(40),
  ultimaPrueba: fechaOpcional,
  proximaPrueba: fechaOpcional,
});

export const accionCorrectoraSchema = z
  .object({
    riesgoId: opcional(40),
    incidenciaId: opcional(40),
    titulo: z.string().trim().min(5, 'Pon un título a la acción.').max(200),
    descripcion: z.string().trim().min(10, 'Describe el resultado esperado.').max(3000),
    prioridad: z.enum(PRIORIDADES_ACCION),
    responsableId: opcional(40),
    fechaLimite: fechaOpcional,
  })
  .superRefine((datos, contexto) => {
    if (Number(Boolean(datos.riesgoId)) + Number(Boolean(datos.incidenciaId)) !== 1) {
      contexto.addIssue({
        code: 'custom',
        path: ['riesgoId'],
        message: 'La acción debe pertenecer a un único riesgo o incidencia.',
      });
    }
  });

export const actualizarAccionCorrectoraSchema = z.object({
  accionId: id,
  estado: z.enum(ESTADOS_ACCION),
  progreso: z.coerce.number().int().min(0).max(100),
  motivoBloqueo: opcional(1000),
  eficacia: opcional(2000),
});

const colorHex = z
  .string()
  .trim()
  .regex(/^#[0-9a-f]{6}$/iu, 'Usa un color hexadecimal, por ejemplo #2563eb.');

export const categoriaRiesgoCrearSchema = z.object({
  clave: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((valor) =>
      valor
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/gu, '')
        .replace(/[^a-z0-9]+/giu, '_')
        .replace(/^_+|_+$/gu, '')
        .toUpperCase(),
    )
    .refine((valor) => valor.length >= 2, 'La clave necesita al menos dos caracteres.'),
  nombre: z.string().trim().min(2, 'Pon un nombre reconocible.').max(100),
  color: colorHex,
});

export const categoriaRiesgoActualizarSchema = z.object({
  categoriaId: id,
  nombre: z.string().trim().min(2, 'Pon un nombre reconocible.').max(100),
  color: colorHex,
  isActive: casilla,
});

export const bandasRiesgoSchema = z
  .object({
    bajoNombre: z.string().trim().min(2).max(50),
    bajoColor: colorHex,
    bajoHasta: z.coerce.number().int().min(1).max(22),
    medioNombre: z.string().trim().min(2).max(50),
    medioColor: colorHex,
    medioHasta: z.coerce.number().int().min(2).max(23),
    altoNombre: z.string().trim().min(2).max(50),
    altoColor: colorHex,
    altoHasta: z.coerce.number().int().min(3).max(24),
    muyAltoNombre: z.string().trim().min(2).max(50),
    muyAltoColor: colorHex,
  })
  .superRefine((datos, contexto) => {
    if (!(datos.bajoHasta < datos.medioHasta && datos.medioHasta < datos.altoHasta)) {
      contexto.addIssue({
        code: 'custom',
        path: ['altoHasta'],
        message: 'Los finales de tramo deben crecer sin solaparse.',
      });
    }
  });
