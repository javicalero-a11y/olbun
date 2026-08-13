/**
 * Pulling readable text out of an uploaded file (SPEC §12, M9).
 *
 * Pure and dependency-free: it decodes what it can decode and says plainly
 * what it cannot. Extraction is what makes the store searchable, and a search
 * that silently misses half the documents is worse than one that tells you
 * which ones it could not read.
 *
 * PDFs and .docx are handled by `lib/services/extraccion`, which needs parsers
 * and is therefore async; scans and the old binary .doc are handled by nobody.
 * Pretending to extract from those by pulling the ASCII runs out of a binary
 * would produce exactly the kind of plausible-looking rubbish that makes a
 * search result untrustworthy, so they are recorded as unextracted and the
 * screen says so.
 */

export type ResultadoExtraccion =
  | { estado: 'EXTRAIDO'; texto: string }
  /** Readable in principle, but this file had nothing in it. */
  | { estado: 'VACIO' }
  /** Needs a parser we do not have yet. */
  | { estado: 'NO_SOPORTADO'; motivo: string };

/** Types whose bytes are text, by MIME type or by extension. */
const TIPOS_DE_TEXTO = [
  'text/',
  'application/json',
  'application/xml',
  'application/x-yaml',
  'application/csv',
];

const EXTENSIONES_DE_TEXTO = [
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.xml',
  '.yaml',
  '.yml',
  '.log',
  '.eml',
];

const MOTIVOS: Readonly<Record<string, string>> = {
  'application/pdf':
    'Este PDF no se ha podido leer aquí; lo intenta el extractor del servicio.',
  'application/msword': 'Los .doc necesitan un extractor propio.',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'Este .docx no se ha podido leer aquí; lo intenta el extractor del servicio.',
  'application/vnd.ms-excel': 'Las hojas de cálculo necesitan un extractor propio.',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'Las hojas de cálculo necesitan un extractor propio.',
};

export function esTexto(mimeType: string, nombre: string): boolean {
  const tipo = mimeType.toLowerCase();
  if (TIPOS_DE_TEXTO.some((prefijo) => tipo.startsWith(prefijo))) return true;

  const minusculas = nombre.toLowerCase();
  return EXTENSIONES_DE_TEXTO.some((extension) => minusculas.endsWith(extension));
}

/**
 * A file is only text if it decodes as text.
 *
 * A null byte is the giveaway: no UTF-8 text contains one, and a binary
 * mislabelled `text/plain` would otherwise be stored as a search index full of
 * control characters.
 */
function pareceBinario(contenido: Buffer): boolean {
  const muestra = contenido.subarray(0, 8000);
  return muestra.includes(0);
}

/** Long documents are truncated: the tail of a 40 MB log is not evidence. */
export const MAXIMO_CARACTERES = 200_000;

export function extraerTexto(
  contenido: Buffer,
  mimeType: string,
  nombre: string,
): ResultadoExtraccion {
  if (!esTexto(mimeType, nombre)) {
    return {
      estado: 'NO_SOPORTADO',
      motivo: MOTIVOS[mimeType.toLowerCase()] ?? 'Este tipo de archivo aún no se indexa.',
    };
  }

  if (pareceBinario(contenido)) {
    return {
      estado: 'NO_SOPORTADO',
      motivo: 'El archivo dice ser texto pero no lo es.',
    };
  }

  const texto = contenido.toString('utf8').slice(0, MAXIMO_CARACTERES).trim();

  return texto === '' ? { estado: 'VACIO' } : { estado: 'EXTRAIDO', texto };
}

/**
 * A short piece of the text around the first match, for the results list.
 *
 * Case- and accent-insensitive, because nobody types "Alcalá" with the accent
 * into a search box and a result set that depends on it is a result set people
 * stop trusting.
 */
export function normalizarBusqueda(valor: string): string {
  return valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function fragmentoAlrededor(
  texto: string,
  consulta: string,
  margen = 90,
): string | null {
  const indice = normalizarBusqueda(texto).indexOf(normalizarBusqueda(consulta));
  if (indice === -1) return null;

  const desde = Math.max(0, indice - margen);
  const hasta = Math.min(texto.length, indice + consulta.length + margen);

  return (
    (desde > 0 ? '…' : '') +
    texto.slice(desde, hasta).replace(/\s+/g, ' ').trim() +
    (hasta < texto.length ? '…' : '')
  );
}
