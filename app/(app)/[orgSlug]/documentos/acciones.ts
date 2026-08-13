'use server';

import { z } from 'zod';

import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import { subirDocumento } from '@/lib/services/documentos';

export interface EstadoDocumentos {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

/** Bigger than any pliego anyone has sent, small enough to refuse a video. */
const TAMANO_MAXIMO = 50 * 1024 * 1024;

const subirSchema = z.object({
  contenido: z.instanceof(Uint8Array),
  nombre: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(200),
  descripcion: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
  tipoId: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
  expedienteId: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
  contratoId: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
  documentoId: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
});

const accionSubir = crearAccion({
  nombre: 'documento.subir',
  permiso: 'documento:upload',
  esquema: subirSchema,
  revalidar: ['/:orgSlug/documentos', '/:orgSlug/expedientes'],
  async ejecutar(datos, { db, sesion, auditar }) {
    if (datos.contenido.byteLength === 0) {
      throw new ErrorDeCampo('archivo', 'El archivo está vacío.');
    }
    if (datos.contenido.byteLength > TAMANO_MAXIMO) {
      throw new ErrorDeCampo('archivo', 'El archivo supera los 50 MB.');
    }

    const resultado = await subirDocumento(db, sesion.organisation.id, {
      nombre: datos.nombre,
      contenido: Buffer.from(datos.contenido),
      mimeType: datos.mimeType,
      descripcion: datos.descripcion,
      tipoId: datos.tipoId,
      expedienteId: datos.expedienteId,
      contratoId: datos.contratoId,
      documentoId: datos.documentoId,
      creadoPorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: resultado.numero === 1 ? 'documento.subir' : 'documento.nueva_version',
      entidad: 'Documento',
      entidadId: resultado.documentoId,
      descripcion:
        resultado.numero === 1
          ? `${datos.nombre} subido`
          : `${datos.nombre} — versión ${String(resultado.numero)}`,
      despues: {
        nombre: datos.nombre,
        version: resultado.numero,
        tamano: datos.contenido.byteLength,
        // Recorded because "we already had these exact bytes" is a fact
        // somebody may need later, and it is invisible otherwise.
        contenidoRepetido: resultado.contenidoRepetido,
      },
    });

    return resultado;
  },
});

export async function subir(
  orgSlug: string,
  _previo: EstadoDocumentos,
  formData: FormData,
): Promise<EstadoDocumentos> {
  const archivo = formData.get('archivo');

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { errores: { archivo: ['Elige un archivo.'] } };
  }

  const leer = (campo: string) => {
    const valor = formData.get(campo);
    return typeof valor === 'string' ? valor : undefined;
  };

  const resultado = await accionSubir(orgSlug, {
    contenido: new Uint8Array(await archivo.arrayBuffer()),
    nombre: archivo.name,
    mimeType: archivo.type || 'application/octet-stream',
    descripcion: leer('descripcion'),
    tipoId: leer('tipoId'),
    expedienteId: leer('expedienteId'),
    contratoId: leer('contratoId'),
    documentoId: leer('documentoId'),
  });

  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }

  const { numero, contenidoRepetido } = resultado.datos;

  return {
    exito:
      numero === 1
        ? `«${archivo.name}» guardado.`
        : `«${archivo.name}» guardado como versión ${String(numero)}.${
            contenidoRepetido ? ' El contenido es idéntico al de una versión anterior.' : ''
          }`,
  };
}
