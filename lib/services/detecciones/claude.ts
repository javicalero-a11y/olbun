import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { TIPOS_DETECCION, tiposPorGravedad } from '@/lib/domain/detecciones/tipos';
import { ErrorMotor, textoFuenteDe } from './motor';
import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';
import type { EntradaAnalisis, MotorDeteccion, ResultadoMotor } from './motor';

/**
 * The Claude detection engine (SPEC §4.4).
 *
 * Two choices here are not preferences and should not be "tidied":
 *
 * **Structured output, not citations.** The API's citations feature and JSON
 * structured output are mutually exclusive — asking for both returns a 400. We
 * need a typed object *and* a checkable quote, so the model returns quotes as
 * ordinary schema fields and the server verifies each one by exact substring
 * match against the source before anything is persisted. The guarantee comes
 * from our own check, not from the model's good faith. See ADR 0006.
 *
 * **The model is never asked for character offsets.** It would produce them
 * willingly and they would be wrong often enough to matter, and a highlight
 * that lands on the wrong words is worse than no highlight. The server finds
 * each quote itself.
 */

/**
 * Bump on any change to the instructions, the schema or the type catalogue.
 * Stored on every detection: without it, "the queue got worse this week" is
 * unanswerable.
 */
export const PROMPT_VERSION = '2026-08-12.1';

export const MODELO_CLAUDE = 'claude-opus-5';

/**
 * Enough room for thinking plus the JSON. Adaptive thinking shares this budget
 * with the answer, so a tight limit truncates the object rather than the
 * reasoning.
 */
const MAX_TOKENS = 8000;

/**
 * Long correspondence is the norm — chains, quoted history, attachments'
 * covering text. Trimming keeps one pathological message from costing more
 * than a day's worth of ordinary ones. Quotes are verified against the same
 * truncated text the model saw, so a truncated tail can never produce a quote
 * that fails verification for the wrong reason.
 */
const MAX_CARACTERES = 60_000;

const propuestaSchema = z.object({
  tipo: z.string(),
  confianza: z.number(),
  extractos: z.array(z.string()).default([]),
  datos: z
    .object({
      importe: z.number().optional(),
      fechaMencionada: z.string().optional(),
      plazoDias: z.number().optional(),
      computoMencionado: z.string().optional(),
      articulosCitados: z.array(z.string()).optional(),
      resumen: z.string().optional(),
    })
    .optional(),
});

/**
 * `detecciones` is required, deliberately. "Nothing to report" has to be an
 * explicit empty array: if a missing key were allowed to mean the same thing,
 * a response of entirely the wrong shape would read as a clean message, which
 * is the one wrong answer nobody would notice.
 */
const respuestaSchema = z.object({ detecciones: z.array(propuestaSchema) });

/** The JSON Schema the API enforces. Kept in step with `respuestaSchema`. */
function esquemaDeSalida(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      detecciones: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tipo: { type: 'string', enum: tiposPorGravedad() },
            confianza: {
              type: 'number',
              description: 'Entre 0 y 1. Qué seguridad hay de que esto está en el documento.',
            },
            extractos: {
              type: 'array',
              description:
                'Citas copiadas palabra por palabra del documento. Nunca parafrasees ni resumas: el servidor comprueba cada cita contra el texto original y descarta la que no aparezca literalmente.',
              items: { type: 'string' },
            },
            datos: {
              type: 'object',
              properties: {
                importe: { type: 'number' },
                fechaMencionada: { type: 'string', format: 'date' },
                plazoDias: { type: 'number' },
                computoMencionado: { type: 'string' },
                articulosCitados: { type: 'array', items: { type: 'string' } },
                resumen: { type: 'string' },
              },
              required: [],
              additionalProperties: false,
            },
          },
          required: ['tipo', 'confianza', 'extractos'],
          additionalProperties: false,
        },
      },
    },
    required: ['detecciones'],
    additionalProperties: false,
  };
}

/**
 * The instructions. Generated from the type catalogue so a type added there is
 * a type the model is told about — a catalogue and a prompt that drift apart
 * produce detections nobody can confirm.
 *
 * Written plainly and without emphasis. Current models follow the system
 * prompt closely, and the shouting that older models needed now overtriggers.
 */
function instrucciones(): string {
  const catalogo = tiposPorGravedad()
    .map((tipo) => {
      const definicion = TIPOS_DETECCION[tipo];
      return `- ${tipo}: ${definicion.descripcion}\n  Señales: ${definicion.senales}`;
    })
    .join('\n');

  return [
    'Analizas correspondencia dirigida a una empresa que presta servicios al sector público en España — limpieza, conserjería, ayuda a domicilio, mantenimiento. Trabajas para el contratista, no para la administración.',
    '',
    'Tu trabajo es señalar lo que un responsable de contrato tendría que ver hoy, con las palabras exactas del documento que lo justifican. No decides nada: una persona revisa cada hallazgo y decide.',
    '',
    'Tipos que puedes señalar:',
    catalogo,
    '',
    'Reglas:',
    '- Cada hallazgo lleva al menos una cita copiada literalmente del documento, carácter a carácter. El servidor comprueba cada cita contra el texto original; la que no aparezca se descarta y baja la confianza del hallazgo.',
    '- Cita la frase que justifica el hallazgo, no el párrafo entero ni una palabra suelta.',
    '- Un mismo documento puede tener varios hallazgos de tipos distintos. No repitas el mismo tipo dos veces.',
    '- Si no hay nada que señalar, devuelve una lista vacía. Un documento corriente no tiene hallazgos, y decirlo es la respuesta correcta.',
    '- La confianza es sobre si el documento dice eso, no sobre lo grave que sea.',
    '- PLAZO_MENCIONADO es para cuando se cita un plazo. Anota los días y el cómputo tal como aparecen en el texto, sin convertirlos ni calcular fechas.',
    '- No incluyas en `datos` nada que no esté en el documento.',
  ].join('\n');
}

/** Same typed request as the online engine, without streaming-only fallbacks. */
export function parametrosClaudeBatch(
  entrada: EntradaAnalisis,
): Anthropic.MessageCreateParamsNonStreaming {
  const texto = textoFuenteDe(entrada).slice(0, MAX_CARACTERES);
  return {
    model: MODELO_CLAUDE,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: {
      effort: 'medium',
      format: { type: 'json_schema', schema: esquemaDeSalida() },
    },
    system: [
      {
        type: 'text',
        text: instrucciones(),
        cache_control: { type: 'ephemeral', ttl: '1h' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Analiza este documento.\n\n<documento>\n${texto}\n</documento>`,
      },
    ],
  };
}

function clientePorDefecto(): Anthropic {
  const clave = serverEnv().ANTHROPIC_API_KEY;

  if (!clave) {
    throw new ErrorMotor(
      'ANTHROPIC_API_KEY no está configurada; el motor de detección de Claude no puede ejecutarse.',
    );
  }

  return new Anthropic({ apiKey: clave });
}

export function hayClaveDeClaude(): boolean {
  return Boolean(serverEnv().ANTHROPIC_API_KEY);
}

export function motorClaude(cliente?: Anthropic): MotorDeteccion {
  return {
    nombre: MODELO_CLAUDE,

    async analizar(entrada: EntradaAnalisis): Promise<ResultadoMotor> {
      const anthropic = cliente ?? clientePorDefecto();
      const texto = textoFuenteDe(entrada).slice(0, MAX_CARACTERES);

      let respuesta;
      try {
        // Streamed because a long chain plus adaptive thinking can outlast a
        // plain request's timeout, and a timeout here would look like "the
        // message has no findings".
        const flujo = anthropic.beta.messages.stream({
          model: MODELO_CLAUDE,
          max_tokens: MAX_TOKENS,
          // Opus 5's classifiers can decline a request outright. Benign legal
          // correspondence occasionally trips them — a letter about a serious
          // workplace accident reads a lot like the things they exist to
          // catch. The fallback re-serves the request on another model inside
          // the same call rather than leaving a message silently unanalysed.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          thinking: { type: 'adaptive' },
          output_config: {
            // Extraction with a server-side check behind it does not need the
            // model's deepest reasoning, and this runs on every message that
            // arrives. Raise it if the queue starts missing things.
            effort: 'medium',
            format: { type: 'json_schema', schema: esquemaDeSalida() },
          },
          system: [
            {
              type: 'text',
              text: instrucciones(),
              // Stable across every message we analyse; the varying part comes
              // after it, in the user turn.
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages: [
            {
              role: 'user',
              content: `Analiza este documento.\n\n<documento>\n${texto}\n</documento>`,
            },
          ],
        });

        respuesta = await flujo.finalMessage();
      } catch (error) {
        throw new ErrorMotor('La llamada al modelo ha fallado.', error);
      }

      if (respuesta.stop_reason === 'refusal') {
        throw new ErrorMotor(
          `El modelo ha rechazado analizar el documento (${respuesta.stop_details?.category ?? 'sin categoría'}).`,
        );
      }

      const bloque = respuesta.content.findLast((parte) => parte.type === 'text');

      if (!bloque) {
        throw new ErrorMotor('El modelo no ha devuelto ningún texto.');
      }

      const propuestas = interpretar(bloque.text);

      return {
        propuestas,
        modelId: respuesta.model,
        promptVersion: PROMPT_VERSION,
        costeTokens: respuesta.usage.input_tokens + respuesta.usage.output_tokens,
      };
    },
  };
}

/**
 * Turns the model's JSON into proposals, dropping anything malformed.
 *
 * Structured output makes malformed JSON unlikely rather than impossible, and
 * a type outside the catalogue would fail at the database anyway. Discarding
 * quietly beats failing the whole message over one bad entry: the other
 * findings in it are still worth a reviewer's time.
 */
export function interpretar(json: string): ResultadoMotor['propuestas'] {
  let crudo: unknown;
  try {
    crudo = JSON.parse(json);
  } catch (error) {
    throw new ErrorMotor('El modelo no ha devuelto JSON válido.', error);
  }

  const analizado = respuestaSchema.safeParse(crudo);
  if (!analizado.success) {
    throw new ErrorMotor('La respuesta del modelo no encaja con el esquema esperado.');
  }

  const vistos = new Set<string>();
  const propuestas: ResultadoMotor['propuestas'] = [];

  for (const entrada of analizado.data.detecciones) {
    if (!(entrada.tipo in TIPOS_DETECCION)) {
      logger.warn({ tipo: entrada.tipo }, 'Tipo de detección desconocido, descartado');
      continue;
    }

    if (vistos.has(entrada.tipo)) continue;
    vistos.add(entrada.tipo);

    propuestas.push({
      tipo: entrada.tipo as ResultadoMotor['propuestas'][number]['tipo'],
      confianza: entrada.confianza,
      extractos: entrada.extractos.map((texto) => ({ texto })),
      datos: entrada.datos,
    });
  }

  return propuestas;
}
