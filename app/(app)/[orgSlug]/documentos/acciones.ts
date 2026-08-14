'use server';

import { z } from 'zod';

import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import { requirePermission } from '@/lib/auth/guardias';
import { reanalizarVersion } from '@/lib/services/analisis-documento';
import { subirDocumento } from '@/lib/services/documentos';
import {
  cambiarBloqueoLegal,
  enviarAPapelera,
  restaurarDesdePapelera,
} from '@/lib/services/gestion-documentos';
import { procesarOcrVersion } from '@/lib/services/ocr';

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

  const { numero, contenidoRepetido, estadoAnalisis, estadoIndexacion } = resultado.datos;
  const seguridad =
    estadoAnalisis === 'LIMPIO'
      ? estadoIndexacion === 'OCR_PENDIENTE'
        ? ' Está limpio y pendiente de OCR.'
        : ' Antivirus limpio.'
      : estadoAnalisis === 'INFECTADO'
        ? ' El antivirus lo ha puesto en cuarentena.'
        : ' ClamAV no estaba disponible: queda bloqueado hasta reanalizarlo.';

  return {
    exito:
      numero === 1
        ? `«${archivo.name}» guardado.${seguridad}`
        : `«${archivo.name}» guardado como versión ${String(numero)}.${
            contenidoRepetido ? ' El contenido es idéntico al de una versión anterior.' : ''
          }${seguridad}`,
  };
}

const documentoSchema = z.object({ documentoId: z.string().trim().min(1) });
const motivoSchema = documentoSchema.extend({ motivo: z.string().trim().min(10).max(500) });
const bloqueoSchema = motivoSchema.extend({ bloquear: z.boolean() });

async function comoErrorDeDocumento<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error) {
    throw new ErrorDeCampo(
      'documentoId',
      error instanceof Error ? error.message : 'No se ha podido modificar el documento.',
    );
  }
}

const accionPapelera = crearAccion({
  nombre: 'documento.eliminar',
  permiso: 'documento:delete',
  esquema: motivoSchema,
  revalidar: ['/:orgSlug/documentos', '/:orgSlug/documentos/papelera'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const cambio = await comoErrorDeDocumento(() =>
      enviarAPapelera(db, datos.documentoId, sesion.user.id, datos.motivo),
    );
    auditar({
      tipo: 'BORRADO',
      accion: 'documento.eliminar',
      entidad: 'Documento',
      entidadId: cambio.id,
      descripcion: `${cambio.nombre} enviado a la papelera`,
      antes: cambio.antes,
      despues: cambio.despues,
    });
    return cambio;
  },
});

const accionRestaurar = crearAccion({
  nombre: 'documento.restaurar',
  permiso: 'documento:restore',
  esquema: documentoSchema,
  // The client removes the restored row locally. The document list is dynamic
  // and reads the restored row on the next navigation, so no RSC refresh is
  // needed here — refreshing would destroy the confirmation message.
  async ejecutar(datos, { db, sesion, auditar }) {
    const cambio = await comoErrorDeDocumento(() =>
      restaurarDesdePapelera(db, datos.documentoId, sesion.user.id),
    );
    auditar({
      tipo: 'MODIFICACION',
      accion: 'documento.restaurar',
      entidad: 'Documento',
      entidadId: cambio.id,
      descripcion: `${cambio.nombre} restaurado desde la papelera`,
      antes: cambio.antes,
      despues: cambio.despues,
    });
    return cambio;
  },
});

const accionBloqueo = crearAccion({
  nombre: 'documento.bloqueo_legal',
  permiso: 'documento:hold',
  esquema: bloqueoSchema,
  revalidar: ['/:orgSlug/documentos', '/:orgSlug/documentos/retencion'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const cambio = await comoErrorDeDocumento(() =>
      cambiarBloqueoLegal(db, datos.documentoId, sesion.user.id, datos.bloquear, datos.motivo),
    );
    auditar({
      tipo: 'MODIFICACION',
      accion: datos.bloquear ? 'documento.bloquear' : 'documento.desbloquear',
      entidad: 'Documento',
      entidadId: cambio.id,
      descripcion: `${datos.bloquear ? 'Bloqueo aplicado a' : 'Bloqueo retirado de'} ${cambio.nombre}`,
      antes: cambio.antes,
      despues: cambio.despues,
    });
    return cambio;
  },
});

function leerTexto(formData: FormData, campo: string): string {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor : '';
}

export async function eliminar(
  orgSlug: string,
  _previo: EstadoDocumentos,
  formData: FormData,
): Promise<EstadoDocumentos> {
  const resultado = await accionPapelera(orgSlug, {
    documentoId: leerTexto(formData, 'documentoId'),
    motivo: leerTexto(formData, 'motivo'),
  });
  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }
  return { exito: `«${resultado.datos.nombre}» está en la papelera y se puede restaurar.` };
}

export async function restaurar(
  orgSlug: string,
  _previo: EstadoDocumentos,
  formData: FormData,
): Promise<EstadoDocumentos> {
  const resultado = await accionRestaurar(orgSlug, {
    documentoId: leerTexto(formData, 'documentoId'),
  });
  return resultado.ok
    ? { exito: `«${resultado.datos.nombre}» restaurado con todas sus versiones.` }
    : { error: resultado.error };
}

export async function cambiarBloqueo(
  orgSlug: string,
  _previo: EstadoDocumentos,
  formData: FormData,
): Promise<EstadoDocumentos> {
  const bloquear = leerTexto(formData, 'bloquear') === 'true';
  const resultado = await accionBloqueo(orgSlug, {
    documentoId: leerTexto(formData, 'documentoId'),
    motivo: leerTexto(formData, 'motivo'),
    bloquear,
  });
  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }
  return {
    exito: bloquear
      ? `«${resultado.datos.nombre}» queda protegido por bloqueo legal.`
      : `Bloqueo legal retirado de «${resultado.datos.nombre}».`,
  };
}

async function contextoProceso(orgSlug: string) {
  const sesion = await requirePermission(orgSlug, 'documento:upload');
  return {
    sesion,
    actor: {
      actorId: sesion.user.id,
      actorEmail: sesion.user.email,
      actorRol: sesion.actor.role,
    },
  };
}

export async function ejecutarOcr(
  orgSlug: string,
  _previo: EstadoDocumentos,
  formData: FormData,
): Promise<EstadoDocumentos> {
  const versionId = leerTexto(formData, 'versionId');
  try {
    const { sesion, actor } = await contextoProceso(orgSlug);
    const resultado = await procesarOcrVersion(sesion.organisation.id, versionId, actor);
    return {
      exito: `OCR ${resultado.completo ? 'completado' : 'parcial'}: ${String(resultado.paginasProcesadas)} de ${String(resultado.paginasTotales)} páginas.`,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'No se ha podido ejecutar el OCR.',
    };
  }
}

export async function reanalizar(
  orgSlug: string,
  _previo: EstadoDocumentos,
  formData: FormData,
): Promise<EstadoDocumentos> {
  const versionId = leerTexto(formData, 'versionId');
  try {
    const { sesion, actor } = await contextoProceso(orgSlug);
    const resultado = await reanalizarVersion(sesion.organisation.id, versionId, actor);
    return {
      exito:
        resultado.estadoAnalisis === 'LIMPIO'
          ? 'Análisis completado: el fichero está limpio.'
          : resultado.estadoAnalisis === 'INFECTADO'
            ? 'El fichero sigue en cuarentena.'
            : 'ClamAV no está disponible; el fichero sigue marcado como no analizado.',
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'No se ha podido repetir el análisis.',
    };
  }
}
