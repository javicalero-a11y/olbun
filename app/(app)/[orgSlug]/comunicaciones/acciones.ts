'use server';

import { z } from 'zod';

import { analizarEml, guardarComunicacion } from '@/lib/services/comunicaciones';
import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import type { TenantTransactionClient } from '@/lib/db/tenant';

export interface EstadoComunicaciones {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

/** Guards against someone uploading a video and waiting for a parse. */
const TAMANO_MAXIMO = 25 * 1024 * 1024;

const subirSchema = z.object({
  contenido: z.instanceof(Uint8Array),
  nombreArchivo: z.string().min(1),
  direccion: z.enum(['ENTRANTE', 'SALIENTE']),
  contratoId: z
    .string()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
});

/**
 * Every organisation gets one manual-upload mailbox, made the first time
 * somebody uploads. Created on demand rather than at sign-up because most of
 * the mailbox types need configuration, and an empty list of mailboxes is
 * easier to understand than one containing a row nobody asked for.
 */
async function buzonDeCargaManual(
  db: TenantTransactionClient,
  organisationId: string,
): Promise<string> {
  const existente = await db.buzonConectado.findFirst({
    where: { tipo: 'CARGA_MANUAL', deletedAt: null },
    select: { id: true },
  });

  if (existente) return existente.id;

  const creado = await db.buzonConectado.create({
    data: {
      organisationId,
      tipo: 'CARGA_MANUAL',
      nombre: 'Carga manual',
    },
    select: { id: true },
  });

  return creado.id;
}

const accionSubir = crearAccion({
  nombre: 'comunicacion.subir',
  permiso: 'comunicacion:view',
  esquema: subirSchema,
  revalidar: ['/:orgSlug/comunicaciones'],
  async ejecutar(datos, { db, sesion, auditar }) {
    if (datos.contenido.byteLength === 0) {
      throw new ErrorDeCampo('archivo', 'El archivo está vacío.');
    }
    if (datos.contenido.byteLength > TAMANO_MAXIMO) {
      throw new ErrorDeCampo('archivo', 'El archivo supera los 25 MB.');
    }

    const analizada = await analizarEml(Buffer.from(datos.contenido));

    const buzonId = await buzonDeCargaManual(db, sesion.organisation.id);

    const resultado = await guardarComunicacion(
      db,
      sesion.organisation.id,
      buzonId,
      analizada,
      {
        direccion: datos.direccion,
        contratoId: datos.contratoId,
        creadoPorId: sesion.user.id,
      },
    );

    // A duplicate is audited too: "we already had this" is a fact somebody may
    // need to prove later, and silence would look like the upload was lost.
    auditar({
      tipo: resultado.estado === 'CREADA' ? 'CREACION' : 'ACCESO',
      accion: resultado.estado === 'CREADA' ? 'comunicacion.subir' : 'comunicacion.duplicada',
      entidad: 'Comunicacion',
      entidadId: resultado.comunicacionId,
      descripcion: `${datos.nombreArchivo}: ${analizada.asunto}`,
      despues: {
        asunto: analizada.asunto,
        de: analizada.de,
        adjuntos: analizada.adjuntos.length,
        duplicada: resultado.estado === 'DUPLICADA',
      },
    });

    return resultado;
  },
});

export async function subirComunicacion(
  orgSlug: string,
  _previo: EstadoComunicaciones,
  formData: FormData,
): Promise<EstadoComunicaciones> {
  const archivo = formData.get('archivo');

  if (!(archivo instanceof File) || archivo.size === 0) {
    return { errores: { archivo: ['Elige un archivo .eml.'] } };
  }

  const contratoId = formData.get('contratoId');
  const direccion = formData.get('direccion');

  const resultado = await accionSubir(orgSlug, {
    contenido: new Uint8Array(await archivo.arrayBuffer()),
    nombreArchivo: archivo.name,
    direccion: direccion === 'SALIENTE' ? 'SALIENTE' : 'ENTRANTE',
    contratoId: typeof contratoId === 'string' ? contratoId : undefined,
  });

  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }

  return {
    exito:
      resultado.datos.estado === 'CREADA'
        ? `«${archivo.name}» añadido a la bandeja.`
        : `«${archivo.name}» ya estaba en la bandeja; no se ha duplicado.`,
  };
}
