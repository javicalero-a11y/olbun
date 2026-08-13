import type { TipoDeteccion } from '@prisma/client';

import type { ExtractoPropuesto } from '@/lib/domain/detecciones/verificacion';

/**
 * What a detection engine is (SPEC §4.4).
 *
 * An interface rather than a direct call to the API, for one reason that
 * matters more than testability: every detection records which engine produced
 * it, and the day a prompt change makes the queue worse, that column is what
 * makes the question answerable. An engine is a named, versioned thing here,
 * not an implementation detail.
 *
 * An engine only ever *proposes*. It cannot write anything, and its quotes are
 * verified against the source before they are stored — see
 * `lib/domain/detecciones/verificacion.ts`.
 */

export interface EntradaAnalisis {
  asunto: string;
  de: string;
  fecha: Date | undefined;
  /** Plain text. HTML is not sent: it is noise, and it costs tokens. */
  cuerpo: string;
}

export interface PropuestaDeteccion {
  tipo: TipoDeteccion;
  /** 0–1, the engine's own opinion. Adjusted by verification afterwards. */
  confianza: number;
  /** Quotes said to justify the claim. Unverified at this point. */
  extractos: ExtractoPropuesto[];
  /** Amounts, dates, articles cited — typed by `tipo`, all optional. */
  datos?: Record<string, unknown> | undefined;
}

export interface ResultadoMotor {
  propuestas: PropuestaDeteccion[];
  /** Recorded on every detection: `claude-opus-5`, `reglas-locales-1`, … */
  modelId: string;
  promptVersion: string;
  /** Input + output tokens, when the engine has a notion of cost. */
  costeTokens?: number | undefined;
}

export interface MotorDeteccion {
  readonly nombre: string;
  analizar: (entrada: EntradaAnalisis) => Promise<ResultadoMotor>;
}

/**
 * The engine could not run — no credentials, the API is down, the response was
 * unusable. Distinct from "found nothing", which is a valid answer.
 */
export class ErrorMotor extends Error {
  constructor(
    mensaje: string,
    readonly causa?: unknown,
  ) {
    super(mensaje);
    this.name = 'ErrorMotor';
  }
}

/**
 * The text the engine reads and quotes from.
 *
 * Built once and reused as the source for verification, so a quote is checked
 * against exactly the bytes the engine was shown. Building it twice, slightly
 * differently, is the obvious way to get quotes that are honest and still fail
 * verification.
 */
export function textoFuenteDe(entrada: EntradaAnalisis): string {
  const cabecera = [`Asunto: ${entrada.asunto}`, `De: ${entrada.de}`];

  if (entrada.fecha) {
    cabecera.push(`Fecha: ${entrada.fecha.toISOString().slice(0, 10)}`);
  }

  return `${cabecera.join('\n')}\n\n${entrada.cuerpo}`;
}
