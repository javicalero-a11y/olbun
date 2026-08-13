import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';

/**
 * The triage forms (SPEC §5.4).
 *
 * Confirming asks for a date rather than taking one from the message, because
 * everything the resulting expediente computes hangs off it. A date lifted
 * from an email header is a guess about when a clock started, and a guess is
 * exactly what this product exists not to make.
 */

export const analizarSchema = z.object({
  comunicacionId: z.string().trim().min(1),
});

export const confirmarSchema = z.object({
  deteccionId: z.string().trim().min(1),
  fechaApertura: z
    .string()
    .refine((valor) => esFechaCivil(valor), 'Introduce una fecha válida (AAAA-MM-DD).'),
  titulo: z
    .string()
    .trim()
    .max(200, 'Como mucho 200 caracteres.')
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
});

export const descartarSchema = z.object({
  deteccionId: z.string().trim().min(1),
  /**
   * Required. The reason is what a prompt review has to work with, and asking
   * for it is the difference between "the queue is noisy" and knowing why.
   */
  motivo: z
    .string()
    .trim()
    .min(3, 'Di en dos palabras por qué no procede; sirve para afinar la detección.')
    .max(500, 'Como mucho 500 caracteres.'),
});
