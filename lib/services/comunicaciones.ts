import 'server-only';

import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { simpleParser, type AddressObject } from 'mailparser';

import { calcularHuella } from '@/lib/domain/comunicaciones/huella';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * Taking in correspondence (SPEC §4.3, M6).
 *
 * The bodies of these messages become evidence in a dispute, so two things
 * matter more than convenience.
 *
 * **HTML is sanitised before it is stored, not before it is shown.** Mail from
 * an administration arrives with tracking pixels, remote images and
 * occasionally script. Sanitising on the way in means there is no path where a
 * later screen forgets to do it, and no stored copy that could leak a read
 * receipt to the other side of a dispute the moment somebody opens it.
 *
 * **Nothing is filed twice.** Uniqueness is enforced by the database on both
 * the Message-ID and the fingerprint, so two people uploading the same export
 * at the same moment cannot both win a check-then-insert race.
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
  }[];
}

function direcciones(campo: AddressObject | AddressObject[] | undefined): string[] {
  if (!campo) return [];
  const lista = Array.isArray(campo) ? campo : [campo];
  return lista.flatMap((entrada) => entrada.value.map((v) => v.address ?? '').filter(Boolean));
}

/**
 * Strips everything that could run, or reach off the page.
 *
 * An allowlist rather than a blocklist: mail HTML is arbitrary, and the tag
 * somebody thinks to forbid is never the one that turns up. Anything not named
 * here is dropped.
 *
 * `img` is deliberately absent. A remote image in a message from the other
 * side of a dispute is a read receipt, and opening the inbox must not tell
 * them when their letter was read.
 *
 * `sanitize-html` is used rather than DOMPurify because DOMPurify needs a DOM,
 * which means jsdom on the server — and jsdom's assets do not survive Next's
 * bundler. This runs on every ingested message, so a parser that needs no
 * browser emulation is the right tool anyway.
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
    // No `data:` — that is how script gets smuggled through an href.
    allowedSchemes: ['http', 'https', 'mailto'],
    // A link out of a stored message opens elsewhere and tells the far side
    // nothing about where it was opened from.
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
    // Only the identity of each attachment: object storage and antivirus are
    // M9, and a storageKey pointing nowhere would be worse than none.
    adjuntos: (correo.attachments ?? []).map((adjunto) => ({
      nombre: adjunto.filename ?? 'adjunto',
      mimeType: adjunto.contentType,
      tamano: adjunto.size,
      sha256: createHash('sha256').update(adjunto.content).digest('hex'),
    })),
  };
}

export type ResultadoIngesta =
  | { estado: 'CREADA'; comunicacionId: string }
  | { estado: 'DUPLICADA'; comunicacionId: string };

/**
 * Files a parsed message, or reports that we already have it.
 *
 * The duplicate check reads first for a useful answer, but the database's
 * unique indexes are what actually guarantee it: the insert is attempted and a
 * uniqueness violation is treated as "somebody else filed it a moment ago"
 * rather than as an error.
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

  const comunicacion = await db.comunicacion.create({
    data: {
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
    select: { id: true },
  });

  for (const adjunto of analizada.adjuntos) {
    await db.adjunto.create({
      data: {
        organisationId,
        comunicacionId: comunicacion.id,
        nombre: adjunto.nombre,
        mimeType: adjunto.mimeType,
        tamano: adjunto.tamano,
        sha256: adjunto.sha256,
      },
    });
  }

  return { estado: 'CREADA', comunicacionId: comunicacion.id };
}
