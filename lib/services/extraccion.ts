import 'server-only';

import { esTexto, extraerTexto, MAXIMO_CARACTERES } from '@/lib/domain/documentos/texto';
import { logger } from '@/lib/logger';
import type { ResultadoExtraccion } from '@/lib/domain/documentos/texto';

/**
 * Extraction for the file types that need more than a decode (M9).
 *
 * The pure module in `lib/domain` handles anything whose bytes are already
 * text. This one adds PDFs, which need a parser, and it lives in the service
 * layer because that parser is async and does real work — `lib/domain` stays
 * pure and synchronous.
 *
 * **A PDF with no extractable text is not an error.** It is almost always a
 * scan, and the honest answer is "this needs OCR", not an empty index entry
 * that makes the document look searched when it has not been.
 */

export function esPdf(mimeType: string, nombre: string): boolean {
  return mimeType.toLowerCase() === 'application/pdf' || nombre.toLowerCase().endsWith('.pdf');
}

/**
 * Pulls the text out of a PDF.
 *
 * `unpdf` is a build of pdf.js packaged for server runtimes — the same engine
 * browsers use, which matters because the PDFs that arrive from public
 * administrations are frequently malformed in ways only a battle-tested parser
 * survives.
 */
async function extraerDePdf(contenido: Buffer): Promise<ResultadoExtraccion> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const documento = await getDocumentProxy(new Uint8Array(contenido));
    const { text } = await extractText(documento, { mergePages: true });

    // `mergePages: true` types `text` as a string; the runtime shape is the
    // same, so the join is only a guard against a future signature change.
    const limpio = (Array.isArray(text) ? (text as string[]).join('\n') : text)
      .replace(/[ \t]+/g, ' ')
      .slice(0, MAXIMO_CARACTERES)
      .trim();

    if (limpio === '') {
      return {
        estado: 'NO_SOPORTADO',
        motivo: 'El PDF no tiene texto: probablemente es un escaneado y necesita OCR.',
      };
    }

    return { estado: 'EXTRAIDO', texto: limpio };
  } catch (error) {
    // A PDF we cannot parse is a document we cannot index, not a failed
    // upload. The file is stored either way; only the search entry is lost.
    logger.warn({ error }, 'No se pudo extraer el texto de un PDF');
    return { estado: 'NO_SOPORTADO', motivo: 'El PDF no se ha podido leer.' };
  }
}

/** The one entry point the upload path uses. */
export async function extraerTextoDeArchivo(
  contenido: Buffer,
  mimeType: string,
  nombre: string,
): Promise<ResultadoExtraccion> {
  if (esPdf(mimeType, nombre)) return extraerDePdf(contenido);
  if (esTexto(mimeType, nombre)) return extraerTexto(contenido, mimeType, nombre);

  return extraerTexto(contenido, mimeType, nombre);
}
