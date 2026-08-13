import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';

/**
 * The incident log and the risk register (SPEC §4.6).
 *
 * `fechaHecho` is a civil date and is validated as one: an incident dated by
 * whatever the browser's clock said, converted through a timezone, is how a
 * report ends up on the wrong side of a month boundary.
 */

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

/** 1–5. Comes off a select, so it arrives as a string. */
const escala = z
  .string()
  .transform((valor) => Number(valor))
  .refine(
    (valor) => Number.isInteger(valor) && valor >= 1 && valor <= 5,
    'Elige un valor de la escala del 1 al 5.',
  );

export const incidenciaSchema = z.object({
  tipo: z.string().trim().min(1, 'Elige el tipo de incidencia.'),
  gravedad: z.string().trim().min(1, 'Elige la gravedad.'),
  fechaHecho: fechaCivil,
  descripcion: z
    .string()
    .trim()
    .min(10, 'Cuenta qué pasó: quien lo lea dentro de un año no estaba allí.')
    .max(4000, 'Como mucho 4.000 caracteres.'),
  contratoId: opcional(40),
  lugar: opcional(200),
  medidasInmediatas: opcional(2000),
  esNotificableAAutoridad: z
    .union([z.literal('on'), z.literal('')])
    .optional()
    .transform((valor) => valor === 'on'),
});

export const riesgoSchema = z.object({
  categoria: z.string().trim().min(1, 'Elige la categoría.'),
  // Cause, event and consequence separately, because "riesgo de penalidad" is
  // not something anybody can act on.
  causa: z.string().trim().min(3, 'Di qué lo provoca.').max(500),
  evento: z.string().trim().min(3, 'Di qué es lo que puede pasar.').max(500),
  consecuencia: z.string().trim().min(3, 'Di en qué se traduce si pasa.').max(500),
  probabilidadInherente: escala,
  impactoInherente: escala,
  respuesta: z.string().trim().min(1),
  controles: opcional(2000),
  contratoId: opcional(40),
});
