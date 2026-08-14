import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';
import { validarGarantiasBuzon } from '@/lib/domain/buzones/conexion';

const opcional = z
  .string()
  .trim()
  .optional()
  .transform((valor) => (valor === '' ? undefined : valor));

const fechaOpcional = opcional.refine(
  (valor) => valor === undefined || esFechaCivil(valor),
  'Introduce una fecha válida (AAAA-MM-DD).',
);

export const iniciarConexionBuzonSchema = z
  .object({
    proveedor: z.enum(['GOOGLE', 'MICROSOFT']),
    contratoId: opcional,
    esPersonal: z.boolean(),
    politicaInternaDocumentoId: opcional,
    consultaRepresentacionFecha: fechaOpcional,
    historicoDesde: fechaOpcional,
  })
  .superRefine((datos, contexto) => {
    const garantias = validarGarantiasBuzon(datos);
    if (garantias.faltan.includes('POLITICA_INTERNA')) {
      contexto.addIssue({
        code: 'custom',
        path: ['politicaInternaDocumentoId'],
        message: 'Selecciona la política interna aprobada antes de conectar un buzón personal.',
      });
    }
    if (garantias.faltan.includes('CONSULTA_REPRESENTACION')) {
      contexto.addIssue({
        code: 'custom',
        path: ['consultaRepresentacionFecha'],
        message: 'Registra la fecha de consulta a la representación de los trabajadores.',
      });
    }
  });

export const sincronizarBuzonSchema = z.object({
  buzonId: z.string().trim().min(1),
});

export const desconectarBuzonSchema = sincronizarBuzonSchema;

export type IniciarConexionBuzon = z.infer<typeof iniciarConexionBuzonSchema>;
