import { describe, expect, it } from 'vitest';

import { aNumero, fraseEnTorno, motorDeReglas } from './reglas';
import { textoFuenteDe } from './motor';
import { verificarExtractos } from '@/lib/domain/detecciones/verificacion';
import type { EntradaAnalisis } from './motor';

/**
 * The rule engine's own accuracy is not the interesting property — it is a
 * fallback and it is allowed to miss things. What must hold is that everything
 * it proposes survives verification: an engine that produced quotes failing
 * our own check would poison the confidence numbers of every detection it made.
 */

function correo(cuerpo: string, asunto = 'Comunicación del Ayuntamiento'): EntradaAnalisis {
  return {
    asunto,
    de: 'contratacion@alcala.es',
    fecha: new Date('2026-03-02T10:15:00.000Z'),
    cuerpo,
  };
}

const CARTA_PENALIDAD = [
  'Estimados señores:',
  '',
  'Se comunica el inicio de expediente sancionador por incumplimiento del pliego.',
  'Se propone una penalidad de 12.500,00 euros.',
  'Disponen de un plazo de diez días hábiles para formular alegaciones.',
].join('\n');

describe('motorDeReglas', () => {
  it('encuentra el expediente sancionador, la penalidad y el plazo', async () => {
    const salida = await motorDeReglas().analizar(correo(CARTA_PENALIDAD));
    const tipos = salida.propuestas.map((propuesta) => propuesta.tipo);

    expect(tipos).toContain('INICIO_EXPEDIENTE_SANCIONADOR');
    expect(tipos).toContain('PREAVISO_PENALIDAD');
    expect(tipos).toContain('PLAZO_MENCIONADO');
  });

  it('deja constancia de qué motor habló', async () => {
    const salida = await motorDeReglas().analizar(correo(CARTA_PENALIDAD));

    // La columna que permite responder a «la cola ha empeorado esta semana».
    expect(salida.modelId).toBe('reglas-locales-1');
    expect(salida.promptVersion).toBe('reglas-1');
  });

  it('todo lo que propone pasa la verificación de citas', async () => {
    const entrada = correo(CARTA_PENALIDAD);
    const salida = await motorDeReglas().analizar(entrada);
    const fuente = textoFuenteDe(entrada);

    expect(salida.propuestas.length).toBeGreaterThan(0);

    for (const propuesta of salida.propuestas) {
      const verificado = verificarExtractos(fuente, propuesta.extractos, propuesta.confianza);
      expect(verificado.sinRespaldo).toBe(false);
      expect(verificado.descartados).toHaveLength(0);
    }
  });

  it('anota los días y el cómputo del plazo tal como aparecen', async () => {
    const salida = await motorDeReglas().analizar(correo(CARTA_PENALIDAD));
    const plazo = salida.propuestas.find((p) => p.tipo === 'PLAZO_MENCIONADO');

    expect(plazo?.datos).toEqual({ plazoDias: 10, computoMencionado: 'hábiles' });
  });

  it('no calcula ninguna fecha de vencimiento', async () => {
    // Un plazo mencionado en un correo no es un Plazo (SPEC §6.4). El motor
    // sólo copia lo que dice el texto.
    const salida = await motorDeReglas().analizar(correo(CARTA_PENALIDAD));
    const plazo = salida.propuestas.find((p) => p.tipo === 'PLAZO_MENCIONADO');

    expect(Object.keys(plazo?.datos ?? {})).not.toContain('fechaVencimiento');
  });

  it('no señala nada en un correo corriente', async () => {
    const salida = await motorDeReglas().analizar(
      correo('Buenos días, adjunto el parte de trabajo del mes. Un saludo.'),
    );

    expect(salida.propuestas).toHaveLength(0);
  });

  it('cita la frase del cuerpo, no la línea del asunto', async () => {
    // «Asunto: Propuesta de penalidad…» es una cita verificable y no dice
    // nada que no se vea ya desde la bandeja. La frase de la carta sí.
    const salida = await motorDeReglas().analizar(
      correo(CARTA_PENALIDAD, 'Propuesta de penalidad por incidencias'),
    );
    const penalidad = salida.propuestas.find((p) => p.tipo === 'PREAVISO_PENALIDAD');

    expect(penalidad?.extractos[0]?.texto).not.toContain('Asunto:');
    expect(penalidad?.extractos[0]?.texto).toContain('penalidad de 12.500,00 euros');
  });

  it('entiende «dispone de N días», que es como se escribe de verdad', async () => {
    const salida = await motorDeReglas().analizar(
      correo('Dispone de quince dias naturales para alegar.'),
    );
    const plazo = salida.propuestas.find((p) => p.tipo === 'PLAZO_MENCIONADO');

    expect(plazo?.datos).toEqual({ plazoDias: 15, computoMencionado: 'naturales' });
  });

  it('mira también el asunto, que a veces lo dice todo', async () => {
    const salida = await motorDeReglas().analizar(
      correo('Adjunto documentación.', 'Papeleta de conciliación'),
    );

    expect(salida.propuestas.map((p) => p.tipo)).toContain('ASUNTO_LABORAL');
  });

  it('no repite un tipo aunque la señal aparezca dos veces', async () => {
    const salida = await motorDeReglas().analizar(
      correo('Penalidad. Y otra penalidad más. Y penalidades varias.'),
    );

    const penalidades = salida.propuestas.filter((p) => p.tipo === 'PREAVISO_PENALIDAD');
    expect(penalidades).toHaveLength(1);
  });

  it('nunca se declara seguro del todo', async () => {
    const salida = await motorDeReglas().analizar(correo(CARTA_PENALIDAD));

    for (const propuesta of salida.propuestas) {
      expect(propuesta.confianza).toBeLessThan(0.8);
    }
  });
});

describe('fraseEnTorno', () => {
  it('devuelve la frase entera, no la palabra suelta', () => {
    const texto = 'Primera frase. Se impone una penalidad grave. Tercera frase.';
    expect(fraseEnTorno(texto, texto.indexOf('penalidad'))).toBe(
      'Se impone una penalidad grave.',
    );
  });

  it('corta por el salto de línea', () => {
    const texto = 'Encabezado\nSe impone una penalidad\nDespedida';
    expect(fraseEnTorno(texto, texto.indexOf('penalidad'))).toBe('Se impone una penalidad');
  });

  it('aguanta un texto sin puntuación', () => {
    expect(fraseEnTorno('penalidad sin puntuar', 0)).toBe('penalidad sin puntuar');
  });

  it('no parte un importe por el punto de los miles', () => {
    // «una penalidad de 12.» diría que la penalidad es de doce euros, y sería
    // una cita verificable: el error tiene que no ocurrir aquí.
    const texto = 'Se propone una penalidad de 12.500,00 euros. Siguiente frase.';
    expect(fraseEnTorno(texto, texto.indexOf('penalidad'))).toBe(
      'Se propone una penalidad de 12.500,00 euros.',
    );
  });
});

describe('aNumero', () => {
  it('entiende las cifras y las palabras', () => {
    expect(aNumero('15')).toBe(15);
    expect(aNumero('quince')).toBe(15);
    expect(aNumero('DIEZ')).toBe(10);
  });

  it('devuelve indefinido para lo que no es un número', () => {
    expect(aNumero('algunos')).toBeUndefined();
    expect(aNumero('')).toBeUndefined();
  });
});
