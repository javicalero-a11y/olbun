import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';

/**
 * The opening form.
 *
 * `fechaApertura` is the date the clock starts from — usually the date a
 * notification took effect, not the date someone got round to typing it in.
 * Everything downstream is computed from it, so it is validated as a strict
 * civil date and never coerced through a timezone.
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

export const expedienteSchema = z.object({
  titulo: z
    .string()
    .trim()
    .min(3, 'Ponle un título que se entienda de un vistazo.')
    .max(200, 'Como mucho 200 caracteres.'),
  tipo: z.string().trim().min(1, 'Elige el tipo de expediente.'),
  jurisdiccion: z.string().trim().min(1, 'Elige la vía.'),
  fechaApertura: fechaCivil,
  plantillaId: opcional(40),
  contratoId: opcional(40),
  organoCompetente: opcional(200),
  parteContraria: opcional(200),
  resumen: opcional(2000),
  cuantia: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' || valor === undefined ? undefined : valor))
    .refine(
      (valor) => valor === undefined || !Number.isNaN(Number(valor.replace(',', '.'))),
      'La cuantía tiene que ser un número.',
    )
    .transform((valor) => (valor === undefined ? undefined : Number(valor.replace(',', '.')))),
});

export type EntradaExpediente = z.infer<typeof expedienteSchema>;
