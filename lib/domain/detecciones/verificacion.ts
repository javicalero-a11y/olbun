/**
 * Checking that a quote is real (SPEC §4.4 and §6.4, AGENTS.md).
 *
 * A detection is a claim about a document plus the words that justify it. The
 * words are what makes the claim reviewable in fifteen seconds instead of five
 * minutes, and they are also the part a language model is most able to get
 * subtly wrong — a paraphrase reads exactly like a quote.
 *
 * So no quote is trusted. Every proposed extract must appear **verbatim** in
 * the source text or it is dropped, and dropping one lowers the detection's
 * confidence. A detection left with no verified quote at all is not shown to
 * anyone: it is recorded as discarded, because a claim nobody can check
 * against the document is worse than no claim.
 *
 * This module is pure and knows nothing about the engine that produced the
 * extracts. That is deliberate — the guarantee must hold whether the proposal
 * came from Claude, from the local rule engine, or from something we have not
 * written yet.
 */

/** What an engine proposes. Offsets are its opinion and are not trusted. */
export interface ExtractoPropuesto {
  texto: string;
  inicioChar?: number | undefined;
  finChar?: number | undefined;
}

/** What we store: the quote, and offsets the server found itself. */
export interface ExtractoVerificado {
  texto: string;
  inicioChar: number;
  finChar: number;
}

export type MotivoDescarte =
  /** The quote does not appear in the source text at all. */
  | 'NO_ENCONTRADO'
  /** Empty or whitespace-only; nothing to verify. */
  | 'VACIO'
  /** Two proposals resolve to the same span of the source. */
  | 'DUPLICADO';

export interface ExtractoDescartado {
  texto: string;
  motivo: MotivoDescarte;
}

export interface ResultadoVerificacion {
  extractos: ExtractoVerificado[];
  descartados: ExtractoDescartado[];
  /** Confidence after the penalty for dropped quotes. */
  confianza: number;
  /**
   * True when nothing survived. The caller must not persist such a detection
   * as reviewable — it goes straight to discarded, and is worth counting.
   */
  sinRespaldo: boolean;
}

/**
 * Whitespace is the one difference we forgive.
 *
 * A model transcribing a quote out of an email reflows it: a line break inside
 * a sentence becomes a space, a non-breaking space becomes an ordinary one.
 * None of that changes which words are in the document, and refusing those
 * quotes would drop good detections for a reason no reviewer would accept.
 *
 * Nothing else is forgiven. Case is significant, accents are significant,
 * punctuation is significant — because "no procederá" and "procederá" differ by
 * a word a paraphrase can lose.
 */
function normalizar(valor: string): string {
  return valor.replace(/[\s\u00A0]+/g, ' ');
}

/**
 * Finds `aguja` in `pajar` under whitespace-insensitive comparison, returning
 * the span in the **original** source coordinates.
 *
 * The offsets matter: the triage screen highlights the quote inside its
 * surrounding paragraph, and an offset that points a few characters off
 * highlights the wrong words — which would undermine the very thing the quote
 * is for. So we map back through an index built while normalising, rather than
 * approximating.
 */
function buscarSpan(pajar: string, aguja: string): { inicio: number; fin: number } | null {
  // Position in the original string of each character of the normalised one.
  const posiciones: number[] = [];
  let normalizado = '';
  let enEspacio = false;

  for (let i = 0; i < pajar.length; i += 1) {
    const caracter = pajar[i] ?? '';
    const esEspacio = /[\s\u00A0]/.test(caracter);

    if (esEspacio) {
      if (!enEspacio && normalizado.length > 0) {
        posiciones.push(i);
        normalizado += ' ';
      }
      enEspacio = true;
      continue;
    }

    enEspacio = false;
    posiciones.push(i);
    normalizado += caracter;
  }

  const agujaNormalizada = normalizar(aguja).trim();
  if (agujaNormalizada === '') return null;

  const indice = normalizado.indexOf(agujaNormalizada);
  if (indice === -1) return null;

  const inicio = posiciones[indice];
  const ultimo = posiciones[indice + agujaNormalizada.length - 1];

  if (inicio === undefined || ultimo === undefined) return null;

  return { inicio, fin: ultimo + 1 };
}

/**
 * The penalty for a quote that did not check out.
 *
 * Proportional rather than fixed: a detection that proposed four quotes and
 * lost one is in better shape than one that proposed two and lost one, and the
 * queue ordering should reflect that. A floor of 0.15 keeps a single surviving
 * quote from scoring so low that the detection is effectively hidden — it is
 * still a real quote from the real document, and a person should get to judge.
 */
function penalizar(confianza: number, verificados: number, propuestos: number): number {
  if (propuestos === 0 || verificados === propuestos) return confianza;

  const proporcion = verificados / propuestos;
  return Math.max(0.15, Number((confianza * proporcion).toFixed(4)));
}

/**
 * Verifies every proposed quote against the source and returns what survives.
 *
 * Never throws: a malformed proposal is a dropped quote, not an incident. The
 * pipeline runs over other people's email, and email is malformed by nature.
 */
export function verificarExtractos(
  textoFuente: string,
  propuestos: readonly ExtractoPropuesto[],
  confianzaModelo: number,
): ResultadoVerificacion {
  const extractos: ExtractoVerificado[] = [];
  const descartados: ExtractoDescartado[] = [];
  const vistos = new Set<string>();

  for (const propuesto of propuestos) {
    const texto = typeof propuesto.texto === 'string' ? propuesto.texto : '';

    if (texto.trim() === '') {
      descartados.push({ texto, motivo: 'VACIO' });
      continue;
    }

    const span = buscarSpan(textoFuente, texto);

    if (!span) {
      descartados.push({ texto, motivo: 'NO_ENCONTRADO' });
      continue;
    }

    const clave = `${String(span.inicio)}:${String(span.fin)}`;
    if (vistos.has(clave)) {
      descartados.push({ texto, motivo: 'DUPLICADO' });
      continue;
    }
    vistos.add(clave);

    // The stored quote is the source's own text, not the engine's transcription
    // of it. If the two differ by so much as a space, what a reviewer reads
    // must be what the document says.
    extractos.push({
      texto: textoFuente.slice(span.inicio, span.fin),
      inicioChar: span.inicio,
      finChar: span.fin,
    });
  }

  const confianzaAcotada = Math.min(1, Math.max(0, confianzaModelo));

  return {
    extractos,
    descartados,
    confianza: penalizar(confianzaAcotada, extractos.length, propuestos.length),
    sinRespaldo: extractos.length === 0,
  };
}

/**
 * The surrounding text a reviewer needs to judge a quote.
 *
 * A quote alone can mislead as easily as it can inform — "se procederá a la
 * resolución" reads very differently with the conditional clause that precedes
 * it. The queue therefore shows the quote inside its context, and this is what
 * computes that context, in the same coordinates as the verified offsets.
 */
export interface ContextoExtracto {
  antes: string;
  cita: string;
  despues: string;
}

export function contextoDe(
  textoFuente: string,
  extracto: ExtractoVerificado,
  margen = 160,
): ContextoExtracto {
  const desde = Math.max(0, extracto.inicioChar - margen);
  const hasta = Math.min(textoFuente.length, extracto.finChar + margen);

  return {
    antes: (desde > 0 ? '…' : '') + textoFuente.slice(desde, extracto.inicioChar),
    cita: textoFuente.slice(extracto.inicioChar, extracto.finChar),
    despues:
      textoFuente.slice(extracto.finChar, hasta) + (hasta < textoFuente.length ? '…' : ''),
  };
}
