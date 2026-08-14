import 'server-only';

import { createHash } from 'node:crypto';
import MsgReader, { type FieldsData } from '@kenjiuno/msgreader';
import sanitizeHtml from 'sanitize-html';
import { simpleParser, type AddressObject } from 'mailparser';

import { calcularHuella } from '@/lib/domain/comunicaciones/huella';
import { extraerTextoDeArchivo } from '@/lib/services/extraccion';

/**
 * Format analysis for correspondence that may become evidence (SPEC §4.3).
 * Parsing has no database concerns; persistence and deduplication live in the
 * parent module.
 */
export interface ComunicacionAnalizada {
  messageIdRFC: string | undefined;
  huella: string;
  asunto: string;
  de: string;
  para: string[];
  cc: string[];
  fechaEnvio: Date | undefined;
  cuerpoTexto: string;
  cuerpoHtmlSanitizado: string | undefined;
  adjuntos: {
    nombre: string;
    mimeType: string;
    tamano: number;
    sha256: string;
    contenido: Buffer;
  }[];
}

export type FormatoComunicacion = 'EML' | 'MSG' | 'PDF';

export class FormatoComunicacionNoSoportado extends Error {
  constructor(nombre: string) {
    super(`«${nombre}» no es un .eml, .msg o PDF compatible.`);
    this.name = 'FormatoComunicacionNoSoportado';
  }
}

function direcciones(campo: AddressObject | AddressObject[] | undefined): string[] {
  if (!campo) return [];
  const lista = Array.isArray(campo) ? campo : [campo];
  return lista.flatMap((entrada) => entrada.value.map((v) => v.address ?? '').filter(Boolean));
}

/**
 * Strips everything that could run, or reach off the page.
 *
 * An allowlist rather than a blocklist: mail from an administration can carry
 * arbitrary HTML. Images are deliberately absent because a remote image is a
 * read receipt; opening the inbox must not tell the other party when it was
 * read.
 */
export function sanitizarHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'p',
      'br',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'a',
      'hr',
    ],
    allowedAttributes: {
      a: ['href', 'title'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
    },
    disallowedTagsMode: 'discard',
  });
}

/** Parses one `.eml` file into the shape the database wants. */
export async function analizarEml(contenido: Buffer): Promise<ComunicacionAnalizada> {
  const correo = await simpleParser(contenido);

  const de = correo.from?.value[0]?.address ?? correo.from?.text ?? '';
  const asunto = correo.subject ?? '(sin asunto)';
  const cuerpoTexto = correo.text ?? '';

  return {
    messageIdRFC: correo.messageId ?? undefined,
    huella: calcularHuella({
      de,
      asunto,
      fecha: correo.date ?? undefined,
      cuerpo: cuerpoTexto,
    }),
    asunto,
    de,
    para: direcciones(correo.to),
    cc: direcciones(correo.cc),
    fechaEnvio: correo.date ?? undefined,
    cuerpoTexto,
    cuerpoHtmlSanitizado: correo.html ? sanitizarHtml(correo.html) : undefined,
    adjuntos: (correo.attachments ?? []).map((adjunto) => ({
      nombre: adjunto.filename ?? 'adjunto',
      mimeType: adjunto.contentType,
      tamano: adjunto.size,
      sha256: createHash('sha256').update(adjunto.content).digest('hex'),
      contenido: adjunto.content,
    })),
  };
}

function fechaValida(valor: string | undefined): Date | undefined {
  if (!valor) return undefined;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha;
}

function mimeDeAdjunto(adjunto: FieldsData): string {
  if (adjunto.attachMimeTag) return adjunto.attachMimeTag;
  const extension = (adjunto.extension ?? '').toLowerCase();
  const conocidos: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.tif': 'image/tiff',
    '.tiff': 'image/tiff',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return conocidos[extension] ?? 'application/octet-stream';
}

/** Parses Outlook's binary `.msg` container without asking Outlook to be installed. */
export function analizarMsg(contenido: Buffer): ComunicacionAnalizada {
  const lector = new MsgReader(new Uint8Array(contenido).buffer);
  const mensaje = lector.getFileData();

  if (mensaje.error) {
    throw new Error(`El archivo .msg no se ha podido leer: ${mensaje.error}`);
  }

  const de = mensaje.senderEmail ?? mensaje.creatorSMTPAddress ?? mensaje.senderName ?? '';
  const para = (mensaje.recipients ?? [])
    .filter((destinatario) => destinatario.recipType === 'to')
    .map((destinatario) => destinatario.email ?? '')
    .filter(Boolean);
  const cc = (mensaje.recipients ?? [])
    .filter((destinatario) => destinatario.recipType === 'cc')
    .map((destinatario) => destinatario.email ?? '')
    .filter(Boolean);
  const asunto = mensaje.subject ?? '(sin asunto)';
  const cuerpoTexto = mensaje.body ?? '';
  const fechaEnvio = fechaValida(mensaje.clientSubmitTime ?? mensaje.messageDeliveryTime);

  const adjuntos = (mensaje.attachments ?? []).map((adjunto) => {
    const extraido = lector.getAttachment(adjunto);
    const bytes = Buffer.from(extraido.content);
    return {
      nombre: extraido.fileName || adjunto.fileName || adjunto.fileNameShort || 'adjunto',
      mimeType: mimeDeAdjunto(adjunto),
      tamano: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      contenido: bytes,
    };
  });

  return {
    messageIdRFC: mensaje.messageId,
    huella: calcularHuella({ de, asunto, fecha: fechaEnvio, cuerpo: cuerpoTexto }),
    asunto,
    de,
    para,
    cc,
    fechaEnvio,
    cuerpoTexto,
    cuerpoHtmlSanitizado: mensaje.bodyHtml ? sanitizarHtml(mensaje.bodyHtml) : undefined,
    adjuntos,
  };
}

/** A PDF has no mail headers, so the uploader supplies the sender and subject. */
export async function analizarPdf(
  contenido: Buffer,
  nombre: string,
  metadatos: { remitente: string; asunto?: string | undefined },
): Promise<ComunicacionAnalizada> {
  const extraido = await extraerTextoDeArchivo(contenido, 'application/pdf', nombre);
  const cuerpoTexto =
    extraido.estado === 'EXTRAIDO'
      ? extraido.texto
      : '[PDF sin texto extraíble; conserva el original y requiere revisión manual.]';
  const asunto = metadatos.asunto?.trim() || nombre.replace(/\.pdf$/i, '');

  return {
    messageIdRFC: undefined,
    huella: calcularHuella({
      de: metadatos.remitente,
      asunto,
      fecha: undefined,
      cuerpo: cuerpoTexto,
    }),
    asunto,
    de: metadatos.remitente,
    para: [],
    cc: [],
    fechaEnvio: undefined,
    cuerpoTexto,
    cuerpoHtmlSanitizado: undefined,
    adjuntos: [],
  };
}

/** One guarded entry point for every manual format promised by M6. */
export async function analizarArchivoComunicacion(
  contenido: Buffer,
  opciones: {
    nombre: string;
    mimeType: string;
    remitentePdf?: string | undefined;
    asuntoPdf?: string | undefined;
  },
): Promise<{ formato: FormatoComunicacion; comunicacion: ComunicacionAnalizada }> {
  const nombre = opciones.nombre.toLowerCase();
  let formato: FormatoComunicacion;
  let comunicacion: ComunicacionAnalizada;

  if (nombre.endsWith('.eml') || opciones.mimeType === 'message/rfc822') {
    formato = 'EML';
    comunicacion = await analizarEml(contenido);
  } else if (nombre.endsWith('.msg') || opciones.mimeType === 'application/vnd.ms-outlook') {
    formato = 'MSG';
    comunicacion = analizarMsg(contenido);
  } else if (nombre.endsWith('.pdf') || opciones.mimeType === 'application/pdf') {
    if (!opciones.remitentePdf?.trim()) {
      throw new Error(
        'Indica el remitente del PDF. El archivo no contiene cabeceras de correo.',
      );
    }
    formato = 'PDF';
    comunicacion = await analizarPdf(contenido, opciones.nombre, {
      remitente: opciones.remitentePdf.trim(),
      asunto: opciones.asuntoPdf,
    });
  } else {
    throw new FormatoComunicacionNoSoportado(opciones.nombre);
  }

  // Preserve the exact source bytes as evidence. A parser can improve later;
  // what actually arrived must never change.
  comunicacion.adjuntos.unshift({
    nombre: opciones.nombre,
    mimeType: opciones.mimeType || 'application/octet-stream',
    tamano: contenido.byteLength,
    sha256: createHash('sha256').update(contenido).digest('hex'),
    contenido,
  });

  return { formato, comunicacion };
}
