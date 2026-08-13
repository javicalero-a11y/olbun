import type { TipoDeteccion } from '@prisma/client';

import type { EntradaAnalisis, MotorDeteccion, PropuestaDeteccion } from './motor';
import { textoFuenteDe } from './motor';

/**
 * A small rule engine, for when no model is configured.
 *
 * This exists so the product works on a laptop with no API key, and so the
 * whole loop — message in, signal found, expediente open — can be exercised by
 * a test that does not depend on a network call or a bill.
 *
 * It is not pretending to be the real thing, and the system does not pretend
 * on its behalf: every detection records `modelId`, this one writes
 * `reglas-locales-1`, and the triage screen says so next to each row. A
 * reviewer can always tell what proposed what.
 *
 * Its ceiling is low by construction. It matches turns of phrase that Spanish
 * public administrations actually use, so what it does find is usually real;
 * it will quietly miss anything phrased differently, which is the entire
 * reason the Claude engine exists.
 */

export const VERSION_REGLAS = 'reglas-1';
export const MODELO_REGLAS = 'reglas-locales-1';

interface Regla {
  tipo: TipoDeteccion;
  patron: RegExp;
  /**
   * Deliberately never near 1. These are phrase matches, and a phrase match
   * cannot know whether the letter is threatening a penalty or recalling one
   * from two years ago.
   */
  confianza: number;
}

const REGLAS: readonly Regla[] = [
  {
    tipo: 'INICIO_EXPEDIENTE_SANCIONADOR',
    patron: /\b(expediente sancionador|acuerdo de incoaci[óo]n|pliego de cargos)\b/i,
    confianza: 0.75,
  },
  {
    tipo: 'AMENAZA_RESOLUCION',
    patron:
      /\b(resoluci[óo]n del contrato|causa de resoluci[óo]n|incautaci[óo]n de la garant[íi]a)\b/i,
    confianza: 0.7,
  },
  {
    tipo: 'PREAVISO_PENALIDAD',
    patron: /\b(penalidad(es)?|penalizaci[óo]n)\b/i,
    confianza: 0.7,
  },
  {
    tipo: 'REQUERIMIENTO_FORMAL',
    patron:
      /\b(se requiere|requerimiento|deber[áa] subsanar|tr[áa]mite de audiencia|formular alegaciones)\b/i,
    confianza: 0.65,
  },
  {
    tipo: 'ASUNTO_LABORAL',
    patron:
      /\b(papeleta de conciliaci[óo]n|juzgado de lo social|acta de infracci[óo]n|inspecci[óo]n de trabajo|SMAC)\b/i,
    confianza: 0.7,
  },
  {
    tipo: 'SUBROGACION',
    patron: /\b(subrogaci[óo]n|personal a subrogar|sucesi[óo]n de empresa)\b/i,
    confianza: 0.7,
  },
  {
    tipo: 'IMPAGO_FACTURA',
    patron:
      /\b(factura[s]? pendiente[s]? de pago|intereses de demora|periodo medio de pago|impago)\b/i,
    confianza: 0.65,
  },
  {
    tipo: 'SOLICITUD_MODIFICADO',
    patron:
      /\b(modificaci[óo]n del contrato|modificado del contrato|ampliaci[óo]n del objeto)\b/i,
    confianza: 0.6,
  },
  {
    tipo: 'RIESGO_PRL',
    patron:
      /\b(riesgo grave e inminente|accidente de trabajo|evaluaci[óo]n de riesgos|coordinaci[óo]n de actividades empresariales)\b/i,
    confianza: 0.65,
  },
  {
    tipo: 'QUEJA_FORMAL',
    patron: /\b(queja formal|escrito de queja|reiteramos la queja)\b/i,
    confianza: 0.6,
  },
  {
    tipo: 'RECLAMACION_USUARIO',
    patron: /\b(hoja de reclamaciones|reclamaci[óo]n del (usuario|residente|familiar))\b/i,
    confianza: 0.6,
  },
  {
    tipo: 'INCUMPLIMIENTO_ALEGADO',
    patron:
      /\b(incumplimiento (del pliego|de las obligaciones|contractual)|deficiencias reiteradas)\b/i,
    confianza: 0.6,
  },
  {
    tipo: 'SINIESTRO',
    patron: /\b(parte de siniestro|da[ñn]os causados|responsabilidad patrimonial)\b/i,
    confianza: 0.6,
  },
  {
    // "en el plazo de diez días hábiles" and "dispone de 15 días naturales"
    // are the two ways this is written; missing the second would miss most of
    // the requirements that actually carry a deadline.
    tipo: 'PLAZO_MENCIONADO',
    patron:
      /\b(?:plazo de|dispone[nl]? de|disponen de)\s+([\wáéíóú]+)\s+d[íi]as(\s+(h[áa]biles|naturales))?/i,
    confianza: 0.7,
  },
];

const NUMEROS: Readonly<Record<string, number>> = {
  un: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
  siete: 7,
  ocho: 8,
  nueve: 9,
  diez: 10,
  once: 11,
  doce: 12,
  trece: 13,
  catorce: 14,
  quince: 15,
  veinte: 20,
  treinta: 30,
};

/** "diez" and "10" are the same deadline; both spellings are common. */
export function aNumero(valor: string): number | undefined {
  const digitos = Number(valor.replace(/\./g, ''));
  if (Number.isFinite(digitos) && digitos > 0) return digitos;

  return NUMEROS[valor.toLowerCase()];
}

/**
 * The sentence a match sits in.
 *
 * A quote has to be enough for a reviewer to judge without opening the
 * message, and a bare phrase is not. Boundaries are full stops, line breaks
 * and semicolons — crude, but it only has to produce something that is
 * genuinely present in the document, and the verifier enforces that.
 */
/**
 * A full stop ends a sentence only when whitespace follows it.
 *
 * Spanish writes thousands with dots, so a naive split on `.` turns "una
 * penalidad de 12.500,00 euros" into "una penalidad de 12." — a quote that
 * says the penalty is twelve euros. The quote would still verify, which is
 * exactly why this needs to be right here rather than caught downstream.
 */
const FIN_DE_FRASE = /[.;](?=\s|$)|\n/g;

export function fraseEnTorno(texto: string, indice: number): string {
  let inicio = 0;
  let fin = texto.length;

  FIN_DE_FRASE.lastIndex = 0;
  let marca = FIN_DE_FRASE.exec(texto);

  while (marca !== null) {
    if (marca.index < indice) {
      inicio = marca.index + marca[0].length;
    } else {
      fin = marca.index + marca[0].length;
      break;
    }
    marca = FIN_DE_FRASE.exec(texto);
  }

  return texto.slice(inicio, fin).trim();
}

export function motorDeReglas(): MotorDeteccion {
  return {
    nombre: MODELO_REGLAS,

    analizar(entrada: EntradaAnalisis) {
      const texto = textoFuenteDe(entrada);
      const propuestas: PropuestaDeteccion[] = [];

      for (const regla of REGLAS) {
        // The body first. The subject line matches often and quotes badly:
        // "Asunto: Propuesta de penalidad…" is technically a verified quote
        // and tells a reviewer nothing they could not see from the inbox. The
        // sentence in the letter is the evidence. Falling back to the whole
        // source keeps subject-only signals — a bare "Papeleta de
        // conciliación" with an empty body is a real message.
        const coincidencia = regla.patron.exec(entrada.cuerpo) ?? regla.patron.exec(texto);
        if (!coincidencia) continue;

        // Quoted from wherever it matched; the body is a substring of the
        // source, so verification finds it either way.
        const frase = fraseEnTorno(coincidencia.input, coincidencia.index);
        if (frase === '') continue;

        const propuesta: PropuestaDeteccion = {
          tipo: regla.tipo,
          confianza: regla.confianza,
          extractos: [{ texto: frase }],
        };

        if (regla.tipo === 'PLAZO_MENCIONADO') {
          const dias = aNumero(coincidencia[1] ?? '');
          const computo = coincidencia[3]?.toLowerCase();

          if (dias !== undefined) {
            propuesta.datos = {
              plazoDias: dias,
              ...(computo ? { computoMencionado: computo } : {}),
            };
          }
        }

        propuestas.push(propuesta);
      }

      return Promise.resolve({
        propuestas,
        modelId: MODELO_REGLAS,
        promptVersion: VERSION_REGLAS,
      });
    },
  };
}
