'use server';

import { randomBytes } from 'node:crypto';
import { z } from 'zod';

import {
  analizarArchivoComunicacion,
  FormatoComunicacionNoSoportado,
  guardarComunicacion,
} from '@/lib/services/comunicaciones';
import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { serverEnv } from '@/lib/env';

export interface EstadoComunicaciones {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

export interface EstadoAlias {
  error?: string;
  exito?: string;
}

/** Guards against someone uploading a video and waiting for a parse. */
const TAMANO_MAXIMO = 25 * 1024 * 1024;

const subirSchema = z.object({
  contenido: z.instanceof(Uint8Array),
  nombreArchivo: z.string().min(1),
  mimeType: z.string().max(200),
  direccion: z.enum(['ENTRANTE', 'SALIENTE']),
  remitentePdf: z.string().trim().max(320).optional(),
  asuntoPdf: z.string().trim().max(500).optional(),
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

    let archivo;
    try {
      archivo = await analizarArchivoComunicacion(Buffer.from(datos.contenido), {
        nombre: datos.nombreArchivo,
        mimeType: datos.mimeType,
        remitentePdf: datos.remitentePdf,
        asuntoPdf: datos.asuntoPdf,
      });
    } catch (error) {
      if (error instanceof FormatoComunicacionNoSoportado) {
        throw new ErrorDeCampo('archivo', error.message);
      }
      if (error instanceof Error) {
        throw new ErrorDeCampo('archivo', error.message);
      }
      throw error;
    }

    const analizada = archivo.comunicacion;

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
        formato: archivo.formato,
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
    return { errores: { archivo: ['Elige un archivo .eml, .msg o PDF.'] } };
  }

  const contratoId = formData.get('contratoId');
  const direccion = formData.get('direccion');
  const remitentePdf = formData.get('remitentePdf');
  const asuntoPdf = formData.get('asuntoPdf');

  const resultado = await accionSubir(orgSlug, {
    contenido: new Uint8Array(await archivo.arrayBuffer()),
    nombreArchivo: archivo.name,
    mimeType: archivo.type || 'application/octet-stream',
    direccion: direccion === 'SALIENTE' ? 'SALIENTE' : 'ENTRANTE',
    contratoId: typeof contratoId === 'string' ? contratoId : undefined,
    remitentePdf: typeof remitentePdf === 'string' ? remitentePdf : undefined,
    asuntoPdf: typeof asuntoPdf === 'string' ? asuntoPdf : undefined,
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

const aliasSchema = z.object({
  contratoId: z
    .string()
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor)),
});

const accionCrearAlias = crearAccion({
  nombre: 'buzon.crear_alias',
  permiso: 'buzon:manage',
  esquema: aliasSchema,
  revalidar: ['/:orgSlug/comunicaciones'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const existente = await db.buzonConectado.findFirst({
      where: {
        tipo: 'ALIAS_REENVIO',
        contratoId: datos.contratoId ?? null,
        deletedAt: null,
      },
      select: { id: true, direccion: true },
    });

    if (existente?.direccion) return existente;

    const direccion = `${sesion.organisation.slug}-${randomBytes(6).toString('hex')}@${serverEnv().INBOUND_EMAIL_DOMAIN}`;
    const buzon = await db.buzonConectado.create({
      data: {
        organisationId: sesion.organisation.id,
        tipo: 'ALIAS_REENVIO',
        nombre: datos.contratoId ? 'Reenvío de contrato' : 'Reenvío general',
        direccion,
        contratoId: datos.contratoId ?? null,
        createdById: sesion.user.id,
      },
      select: { id: true, direccion: true },
    });

    auditar({
      tipo: 'CREACION',
      accion: 'buzon.crear_alias',
      entidad: 'BuzonConectado',
      entidadId: buzon.id,
      descripcion: direccion,
      despues: { direccion, contratoId: datos.contratoId ?? null },
    });

    return buzon;
  },
});

export async function crearAliasReenvio(
  orgSlug: string,
  _previo: EstadoAlias,
  formData: FormData,
): Promise<EstadoAlias> {
  const contratoId = formData.get('contratoId');
  const resultado = await accionCrearAlias(orgSlug, {
    contratoId: typeof contratoId === 'string' ? contratoId : undefined,
  });

  if (!resultado.ok) return { error: resultado.error };
  return { exito: `Alias preparado: ${resultado.datos.direccion ?? ''}` };
}
