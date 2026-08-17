import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';
import { esHoraDelDia } from '@/lib/domain/jornada/horas';

/**
 * Recording a day's work (M13).
 *
 * Nothing here is editable later, so the validation is the last chance to
 * catch a typo before it is sealed into the chain. A wrong record is corrected
 * by adding another one, which is honest but noisier — worth one careful check
 * at the door.
 */

const hora = z.string().refine(esHoraDelDia, 'Usa el formato HH:MM en 24 horas.');

const casilla = z
  .union([z.literal('on'), z.literal(''), z.boolean()])
  .optional()
  .transform((valor) => valor === 'on' || valor === true);

export const ORIGENES_JORNADA = [
  'TERMINAL_FICHAJE',
  'APP_MOVIL',
  'GEOLOCALIZACION',
  'MANUAL',
  'IMPORTADO',
] as const;

export const ETIQUETAS_ORIGEN: Readonly<Record<(typeof ORIGENES_JORNADA)[number], string>> = {
  TERMINAL_FICHAJE: 'Terminal de fichaje',
  APP_MOVIL: 'App móvil',
  GEOLOCALIZACION: 'Geolocalización',
  MANUAL: 'Introducido a mano',
  IMPORTADO: 'Importado',
};

export const registroJornadaSchema = z
  .object({
    empleadoId: z.string().trim().min(1, 'Elige a la persona.'),
    fecha: z.string().refine(esFechaCivil, 'Introduce una fecha válida.'),
    horaEntrada: hora,
    horaSalida: hora,
    /** `HH:MM-HH:MM`, comma separated. One line is easier than a repeater. */
    pausas: z
      .string()
      .trim()
      .optional()
      .transform((valor) => (valor === '' ? undefined : valor)),
    horasOrdinariasPactadas: z
      .union([z.string(), z.number()])
      .transform((valor) =>
        typeof valor === 'number' ? valor : Number(valor.replace(',', '.')),
      )
      .refine((valor) => Number.isFinite(valor) && valor > 0 && valor <= 24, {
        message: 'La jornada pactada debe estar entre 0 y 24 horas.',
      }),
    esFestivo: casilla,
    origen: z.enum(ORIGENES_JORNADA),
    corrigeARegistroId: z
      .string()
      .trim()
      .optional()
      .transform((valor) => (valor === '' ? undefined : valor)),
  })
  .refine((datos) => datos.pausas === undefined || pausasValidas(datos.pausas), {
    message: 'Escribe las pausas como 12:00-12:30, separadas por comas.',
    path: ['pausas'],
  });

export function analizarPausas(valor: string | undefined): { desde: string; hasta: string }[] {
  if (!valor) return [];

  return valor
    .split(',')
    .map((tramo) => tramo.trim())
    .filter((tramo) => tramo.length > 0)
    .map((tramo) => {
      const [desde = '', hasta = ''] = tramo.split('-').map((parte) => parte.trim());
      return { desde, hasta };
    });
}

function pausasValidas(valor: string): boolean {
  const pausas = analizarPausas(valor);
  if (pausas.length === 0) return false;

  return pausas.every((pausa) => esHoraDelDia(pausa.desde) && esHoraDelDia(pausa.hasta));
}
