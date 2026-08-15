import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';
import { TIPOS_AUSENCIA } from '@/lib/domain/personal/ausencias';

/**
 * Absence input (M12).
 *
 * The medical diagnosis is deliberately not a field. It is Article 9 health
 * data, it is not needed to cover a shift, and the safest place for data you
 * are not allowed to lose is a form that never asked for it.
 */

const fecha = z.string().refine(esFechaCivil, 'Introduce una fecha válida.');

const opcional = (maximo: number) =>
  z
    .string()
    .trim()
    .max(maximo)
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor));

const casilla = z
  .union([z.literal('on'), z.literal(''), z.boolean()])
  .optional()
  .transform((valor) => valor === 'on' || valor === true);

export const TIPOS = Object.keys(TIPOS_AUSENCIA) as [string, ...string[]];

export const ausenciaSchema = z
  .object({
    empleadoId: z.string().trim().min(1, 'Elige a la persona.'),
    tipo: z.enum(TIPOS),
    subtipo: opcional(120),
    fechaInicio: fecha,
    fechaFinPrevista: z
      .string()
      .optional()
      .transform((valor) => (valor === '' ? undefined : valor))
      .refine(
        (valor) => valor === undefined || esFechaCivil(valor),
        'Introduce una fecha válida.',
      ),
    numeroParteSS: opcional(40),
    mutua: opcional(120),
    esRecaida: casilla,
  })
  .refine(
    (datos) =>
      datos.fechaFinPrevista === undefined || datos.fechaFinPrevista >= datos.fechaInicio,
    { message: 'La fecha de fin es anterior al inicio.', path: ['fechaFinPrevista'] },
  );

export const cierreAusenciaSchema = z.object({
  ausenciaId: z.string().trim().min(1),
  fechaFinReal: fecha,
});
