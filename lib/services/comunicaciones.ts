import 'server-only';

import type { TenantTransactionClient } from '@/lib/db/tenant';
import { guardarObjeto } from '@/lib/storage/objetos';
import type { ComunicacionAnalizada } from './comunicaciones/analisis';

export * from './comunicaciones/analisis';

export type ResultadoIngesta =
  | { estado: 'CREADA'; comunicacionId: string }
  | { estado: 'DUPLICADA'; comunicacionId: string };

/**
 * Files a parsed message, or reports that we already have it.
 *
 * The duplicate check reads first for a useful answer, but database uniqueness
 * is what settles concurrent uploads. Source bytes and attachments are kept as
 * immutable objects only by the process that wins the insert.
 */
export async function guardarComunicacion(
  db: TenantTransactionClient,
  organisationId: string,
  buzonId: string,
  analizada: ComunicacionAnalizada,
  opciones: {
    direccion: 'ENTRANTE' | 'SALIENTE';
    contratoId?: string | undefined;
    creadoPorId?: string | undefined;
  },
): Promise<ResultadoIngesta> {
  const existente = await db.comunicacion.findFirst({
    where: {
      OR: [
        ...(analizada.messageIdRFC ? [{ messageIdRFC: analizada.messageIdRFC }] : []),
        { huella: analizada.huella },
      ],
    },
    select: { id: true },
  });

  if (existente) return { estado: 'DUPLICADA', comunicacionId: existente.id };

  const insertada = await db.comunicacion.createMany({
    data: [
      {
        organisationId,
        buzonId,
        messageIdRFC: analizada.messageIdRFC ?? null,
        huella: analizada.huella,
        direccion: opciones.direccion,
        de: analizada.de,
        para: analizada.para,
        cc: analizada.cc,
        asunto: analizada.asunto,
        fechaEnvio: analizada.fechaEnvio ?? null,
        fechaRecepcion: analizada.fechaEnvio ?? new Date(),
        cuerpoTexto: analizada.cuerpoTexto,
        cuerpoHtmlSanitizado: analizada.cuerpoHtmlSanitizado ?? null,
        contratoId: opciones.contratoId ?? null,
        // 1 means a person chose it; automatic matching arrives with detection.
        confianzaVinculacion: opciones.contratoId ? 1 : null,
        createdById: opciones.creadoPorId ?? null,
      },
    ],
    skipDuplicates: true,
  });

  // Look up by both keys. If another request won on Message-ID while deriving a
  // slightly different fingerprint, looking up only by fingerprint would turn
  // a harmless duplicate into a false persistence error.
  const comunicacion = await db.comunicacion.findFirst({
    where: {
      OR: [
        ...(analizada.messageIdRFC ? [{ messageIdRFC: analizada.messageIdRFC }] : []),
        { huella: analizada.huella },
      ],
    },
    select: { id: true },
  });

  if (!comunicacion) {
    throw new Error('La comunicación se guardó pero no se pudo recuperar.');
  }

  if (insertada.count === 0) {
    return { estado: 'DUPLICADA', comunicacionId: comunicacion.id };
  }

  for (const adjunto of analizada.adjuntos) {
    const objeto = await guardarObjeto(organisationId, adjunto.contenido, {
      nombre: adjunto.nombre,
      mimeType: adjunto.mimeType,
    });
    await db.adjunto.create({
      data: {
        organisationId,
        comunicacionId: comunicacion.id,
        nombre: adjunto.nombre,
        mimeType: adjunto.mimeType,
        tamano: adjunto.tamano,
        sha256: adjunto.sha256,
        storageKey: objeto.clave,
        estadoAntivirus: 'PENDIENTE',
      },
    });
  }

  return { estado: 'CREADA', comunicacionId: comunicacion.id };
}
