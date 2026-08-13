'use server';

import { z } from 'zod';

import { crearAccion } from '@/lib/actions/crear-accion';
import { purgarDocumento } from '@/lib/services/retencion';

export interface EstadoRetencion {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const purgarSchema = z.object({
  documentoId: z.string().trim().min(1),
  /**
   * The person types the word. Not friction for its own sake: this is the one
   * action in the application that destroys bytes, and a misplaced click on a
   * row should not be able to do it.
   */
  confirmacion: z.string().trim(),
});

const accionPurgar = crearAccion({
  nombre: 'documento.purgar',
  permiso: 'documento:delete',
  esquema: purgarSchema,
  revalidar: ['/:orgSlug/documentos', '/:orgSlug/documentos/retencion'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const resultado = await purgarDocumento(db, datos.documentoId, sesion.user.id);

    auditar({
      tipo: 'BORRADO',
      accion: 'documento.purgar',
      entidad: 'Documento',
      entidadId: datos.documentoId,
      descripcion: `${resultado.nombre} purgado por cumplimiento del plazo de conservación`,
      // The content is gone; this is what remains to show the policy was
      // applied, so it records the shape of what was removed rather than any
      // of it.
      antes: {
        nombre: resultado.nombre,
        versiones: resultado.versionesBorradas,
        objetos: resultado.objetosBorrados,
      },
    });

    return resultado;
  },
});

export async function purgar(
  orgSlug: string,
  _previo: EstadoRetencion,
  formData: FormData,
): Promise<EstadoRetencion> {
  const confirmacion = formData.get('confirmacion');

  if (typeof confirmacion !== 'string' || confirmacion.trim().toUpperCase() !== 'PURGAR') {
    return { errores: { confirmacion: ['Escribe PURGAR para confirmar.'] } };
  }

  const documentoId = formData.get('documentoId');

  const resultado = await accionPurgar(orgSlug, {
    documentoId: typeof documentoId === 'string' ? documentoId : '',
    confirmacion,
  });

  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }

  const { nombre, versionesBorradas, objetosBorrados } = resultado.datos;
  const conservados = versionesBorradas - objetosBorrados;

  return {
    exito:
      conservados > 0
        ? `«${nombre}» purgado: ${String(versionesBorradas)} versiones. ${String(conservados)} ficheros siguen en el almacén porque otro documento tiene el mismo contenido.`
        : `«${nombre}» purgado: ${String(versionesBorradas)} versiones y sus ficheros.`,
  };
}
