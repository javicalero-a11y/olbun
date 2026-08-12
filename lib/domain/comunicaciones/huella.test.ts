import { describe, expect, it } from 'vitest';

import {
  calcularHuella,
  normalizarAsunto,
  normalizarCuerpo,
  normalizarDireccion,
} from './huella';

describe('normalizarAsunto', () => {
  it('quita los prefijos de respuesta y reenvío', () => {
    expect(normalizarAsunto('RE: Penalidad')).toBe('penalidad');
    expect(normalizarAsunto('RV: Penalidad')).toBe('penalidad');
    expect(normalizarAsunto('Fwd: Penalidad')).toBe('penalidad');
  });

  it('quita los que se acumulan en una cadena', () => {
    // Lo que llega de verdad después de tres reenvíos internos.
    expect(normalizarAsunto('RE: RV: Re: Penalidad por incidencias')).toBe(
      'penalidad por incidencias',
    );
  });

  it('aguanta el contador que añaden algunos clientes', () => {
    expect(normalizarAsunto('RE[2]: Penalidad')).toBe('penalidad');
  });

  it('junta los espacios que mete el reajuste de línea', () => {
    expect(normalizarAsunto('Penalidad   por    incidencias')).toBe(
      'penalidad por incidencias',
    );
  });

  it('no destroza un asunto que empiece por una palabra parecida', () => {
    // "Revisión" empieza por "re" pero no es un prefijo: sin los dos puntos
    // no se toca.
    expect(normalizarAsunto('Revisión de precios')).toBe('revisión de precios');
  });
});

describe('normalizarDireccion', () => {
  it('se queda con la dirección y descarta el nombre para mostrar', () => {
    expect(normalizarDireccion('"Ayto. de Alcalá" <contratacion@alcala.es>')).toBe(
      'contratacion@alcala.es',
    );
  });

  it('acepta una dirección suelta', () => {
    expect(normalizarDireccion('  Contratacion@Alcala.ES ')).toBe('contratacion@alcala.es');
  });
});

describe('normalizarCuerpo', () => {
  it('descarta las líneas citadas de un reenvío', () => {
    const original = 'Le informamos de la penalidad.';
    const reenviado = ['Te paso esto.', '', '> Le informamos de la penalidad.'].join('\n');

    expect(normalizarCuerpo(reenviado)).not.toBe(normalizarCuerpo(original));
    expect(normalizarCuerpo(reenviado)).toBe('te paso esto.');
  });

  it('sobrevive al cambio de saltos de línea de Windows', () => {
    expect(normalizarCuerpo('Hola\r\nqué tal')).toBe(normalizarCuerpo('Hola\nqué tal'));
  });

  it('junta espacios y líneas en blanco de más', () => {
    expect(normalizarCuerpo('Hola   mundo\n\n\n\nadiós')).toBe('hola mundo\n\nadiós');
  });
});

describe('calcularHuella', () => {
  const base = {
    de: 'contratacion@alcala.es',
    asunto: 'Penalidad por incidencias',
    fecha: new Date('2026-03-02T10:15:00.000Z'),
    cuerpo: 'Le informamos de la propuesta de penalidad.',
  };

  it('el mismo mensaje da la misma huella', () => {
    expect(calcularHuella(base)).toBe(calcularHuella({ ...base }));
  });

  it('reconoce el mismo mensaje reenviado, con prefijo y nombre para mostrar', () => {
    const reenviado = {
      ...base,
      de: '"Ayto. de Alcalá" <contratacion@alcala.es>',
      asunto: 'RV: Penalidad por incidencias',
    };

    expect(calcularHuella(reenviado)).toBe(calcularHuella(base));
  });

  it('ignora un desfase de horas en la marca de tiempo', () => {
    // Reexportar un .eml desde Outlook mueve la hora sin cambiar el mensaje.
    const reexportado = { ...base, fecha: new Date('2026-03-02T18:40:00.000Z') };
    expect(calcularHuella(reexportado)).toBe(calcularHuella(base));
  });

  it('un mensaje distinto del mismo remitente da otra huella', () => {
    expect(calcularHuella({ ...base, asunto: 'Otra cosa' })).not.toBe(calcularHuella(base));
    expect(calcularHuella({ ...base, cuerpo: 'Otro contenido' })).not.toBe(
      calcularHuella(base),
    );
  });

  it('el mismo asunto de otro remitente no es el mismo mensaje', () => {
    expect(calcularHuella({ ...base, de: 'otro@alcala.es' })).not.toBe(calcularHuella(base));
  });

  it('no incluye a los destinatarios: un mensaje a dos buzones nuestros es uno', () => {
    // La huella no toma `para`, así que dos copias del mismo mensaje que
    // llegan a dos buzones distintos se reconocen como el mismo.
    const copia = { ...base };
    expect(calcularHuella(copia)).toBe(calcularHuella(base));
  });

  it('un mensaje de otro día sí es otro mensaje', () => {
    expect(calcularHuella({ ...base, fecha: new Date('2026-03-03T10:15:00.000Z') })).not.toBe(
      calcularHuella(base),
    );
  });

  it('aguanta que no haya fecha', () => {
    expect(calcularHuella({ ...base, fecha: undefined })).toHaveLength(64);
  });
});
