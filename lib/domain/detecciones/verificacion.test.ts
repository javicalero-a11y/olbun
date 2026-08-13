import { describe, expect, it } from 'vitest';

import { contextoDe, verificarExtractos } from './verificacion';

/**
 * The property under test is narrow and load-bearing: a quote that survives
 * appears literally in the document, and one that does not is gone. Everything
 * the triage screen shows a reviewer rests on this being true.
 */

const CARTA = [
  'Estimados señores:',
  '',
  'Por medio del presente escrito se les comunica el inicio de expediente',
  'sancionador por incumplimiento de las obligaciones del pliego, con propuesta',
  'de penalidad por importe de 12.500,00 euros.',
  '',
  'Disponen de un plazo de diez días hábiles para formular alegaciones.',
].join('\n');

describe('verificarExtractos', () => {
  it('acepta una cita que está literalmente en el documento', () => {
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'propuesta\nde penalidad por importe de 12.500,00 euros' }],
      0.9,
    );

    expect(salida.extractos).toHaveLength(1);
    expect(salida.descartados).toHaveLength(0);
    expect(salida.confianza).toBe(0.9);
    expect(salida.sinRespaldo).toBe(false);
  });

  it('descarta una paráfrasis, por plausible que suene', () => {
    // Esto es exactamente lo que hay que impedir: dice lo mismo que la carta y
    // no está en la carta.
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'se propone una penalidad de 12.500 euros' }],
      0.9,
    );

    expect(salida.extractos).toHaveLength(0);
    expect(salida.descartados[0]?.motivo).toBe('NO_ENCONTRADO');
    expect(salida.sinRespaldo).toBe(true);
  });

  it('una cita a la que le falta una palabra no cuela', () => {
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'plazo de días hábiles para formular alegaciones' }],
      0.8,
    );

    expect(salida.extractos).toHaveLength(0);
  });

  it('respeta los acentos y las mayúsculas', () => {
    const salida = verificarExtractos(CARTA, [{ texto: 'dias habiles' }], 0.8);
    expect(salida.extractos).toHaveLength(0);
  });

  it('perdona el reajuste de línea, que no cambia las palabras', () => {
    // Un modelo que transcribe una cita de un correo junta las líneas.
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'inicio de expediente sancionador por incumplimiento' }],
      0.9,
    );

    expect(salida.extractos).toHaveLength(1);
    // Lo que se guarda es el texto del documento, con su salto de línea.
    expect(salida.extractos[0]?.texto).toContain('\n');
  });

  it('perdona el espacio duro que meten los clientes de correo', () => {
    const conEspacioDuro = 'Importe de 12.500,00 euros.';
    const salida = verificarExtractos(
      conEspacioDuro,
      [{ texto: 'Importe de 12.500,00 euros' }],
      0.9,
    );

    expect(salida.extractos).toHaveLength(1);
  });
});

describe('verificarExtractos — desplazamientos', () => {
  it('calcula los suyos propios y no se fía de los del modelo', () => {
    const salida = verificarExtractos(
      CARTA,
      // Desplazamientos deliberadamente absurdos.
      [{ texto: 'diez días hábiles', inicioChar: 0, finChar: 5 }],
      0.9,
    );

    const extracto = salida.extractos[0];
    expect(extracto).toBeDefined();
    expect(CARTA.slice(extracto?.inicioChar, extracto?.finChar)).toBe('diez días hábiles');
  });

  it('los desplazamientos apuntan al texto de verdad tras el reajuste', () => {
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'expediente sancionador por incumplimiento' }],
      0.9,
    );

    const extracto = salida.extractos[0];
    expect(extracto).toBeDefined();
    // El texto guardado y el recortado del original coinciden carácter a
    // carácter: es la garantía de que el resaltado señala lo que dice el
    // documento.
    expect(CARTA.slice(extracto?.inicioChar, extracto?.finChar)).toBe(extracto?.texto);
  });
});

describe('verificarExtractos — confianza', () => {
  it('no penaliza cuando todo se verifica', () => {
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'diez días hábiles' }, { texto: '12.500,00 euros' }],
      0.9,
    );

    expect(salida.confianza).toBe(0.9);
  });

  it('penaliza en proporción a lo que se cae', () => {
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'diez días hábiles' }, { texto: 'inventado' }],
      0.9,
    );

    expect(salida.extractos).toHaveLength(1);
    expect(salida.confianza).toBeCloseTo(0.45, 4);
  });

  it('penaliza menos cuando sobrevive la mayoría', () => {
    const tres = verificarExtractos(
      CARTA,
      [
        { texto: 'diez días hábiles' },
        { texto: '12.500,00 euros' },
        { texto: 'sancionador' },
        { texto: 'inventado' },
      ],
      0.8,
    );

    const dos = verificarExtractos(
      CARTA,
      [{ texto: 'diez días hábiles' }, { texto: 'inventado' }],
      0.8,
    );

    expect(tres.confianza).toBeGreaterThan(dos.confianza);
  });

  it('no hunde del todo a una detección con una cita buena', () => {
    const salida = verificarExtractos(
      CARTA,
      [
        { texto: 'diez días hábiles' },
        { texto: 'inventado uno' },
        { texto: 'inventado dos' },
        { texto: 'inventado tres' },
        { texto: 'inventado cuatro' },
        { texto: 'inventado cinco' },
        { texto: 'inventado seis' },
        { texto: 'inventado siete' },
      ],
      0.6,
    );

    expect(salida.extractos).toHaveLength(1);
    expect(salida.confianza).toBe(0.15);
  });

  it('acota una confianza fuera de rango', () => {
    expect(verificarExtractos(CARTA, [{ texto: 'sancionador' }], 4.2).confianza).toBe(1);
    expect(verificarExtractos(CARTA, [{ texto: 'sancionador' }], -1).confianza).toBe(0);
  });
});

describe('verificarExtractos — entradas hostiles', () => {
  it('descarta una cita vacía sin romperse', () => {
    const salida = verificarExtractos(CARTA, [{ texto: '   ' }], 0.9);
    expect(salida.descartados[0]?.motivo).toBe('VACIO');
    expect(salida.sinRespaldo).toBe(true);
  });

  it('descarta la segunda cita cuando dos apuntan al mismo sitio', () => {
    const salida = verificarExtractos(
      CARTA,
      [{ texto: 'diez días hábiles' }, { texto: 'diez días  hábiles' }],
      0.9,
    );

    expect(salida.extractos).toHaveLength(1);
    expect(salida.descartados[0]?.motivo).toBe('DUPLICADO');
  });

  it('no encuentra nada en un documento vacío', () => {
    const salida = verificarExtractos('', [{ texto: 'lo que sea' }], 0.9);
    expect(salida.sinRespaldo).toBe(true);
  });

  it('sin citas propuestas no hay respaldo', () => {
    const salida = verificarExtractos(CARTA, [], 0.95);
    expect(salida.sinRespaldo).toBe(true);
    // Sin propuestas no hay nada que penalizar: es el `sinRespaldo` lo que
    // impide que esto llegue a la cola.
    expect(salida.confianza).toBe(0.95);
  });

  it('aguanta un texto que no es texto', () => {
    const salida = verificarExtractos(
      CARTA,
      [{ texto: null as unknown as string }, { texto: 42 as unknown as string }],
      0.9,
    );

    expect(salida.extractos).toHaveLength(0);
    expect(salida.descartados).toHaveLength(2);
  });
});

describe('contextoDe', () => {
  it('devuelve la cita con lo que la rodea', () => {
    const salida = verificarExtractos(CARTA, [{ texto: 'diez días hábiles' }], 0.9);
    const extracto = salida.extractos[0];
    expect(extracto).toBeDefined();

    const contexto = contextoDe(CARTA, extracto!, 40);

    expect(contexto.cita).toBe('diez días hábiles');
    expect(contexto.antes).toContain('plazo de');
    expect(contexto.despues).toContain('alegaciones');
  });

  it('marca con puntos suspensivos que hay más documento a los lados', () => {
    const salida = verificarExtractos(CARTA, [{ texto: 'sancionador' }], 0.9);
    const contexto = contextoDe(CARTA, salida.extractos[0]!, 10);

    expect(contexto.antes.startsWith('…')).toBe(true);
    expect(contexto.despues.endsWith('…')).toBe(true);
  });

  it('no inventa puntos suspensivos al principio ni al final del documento', () => {
    const corto = 'Requerimiento formal.';
    const salida = verificarExtractos(corto, [{ texto: 'Requerimiento formal.' }], 0.9);
    const contexto = contextoDe(corto, salida.extractos[0]!, 50);

    expect(contexto.antes).toBe('');
    expect(contexto.despues).toBe('');
  });
});
