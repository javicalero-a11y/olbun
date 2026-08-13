import { describe, expect, it } from 'vitest';

import { esTexto, extraerTexto, fragmentoAlrededor, normalizarBusqueda } from './texto';

describe('esTexto', () => {
  it('reconoce el texto por su tipo MIME', () => {
    expect(esTexto('text/plain', 'x')).toBe(true);
    expect(esTexto('application/json', 'x')).toBe(true);
  });

  it('lo reconoce también por la extensión, que es lo que llega de verdad', () => {
    // Muchos navegadores mandan application/octet-stream para un .csv.
    expect(esTexto('application/octet-stream', 'plantilla.csv')).toBe(true);
    expect(esTexto('', 'REQUERIMIENTO.MD')).toBe(true);
  });

  it('no confunde un PDF con texto', () => {
    expect(esTexto('application/pdf', 'pliego.pdf')).toBe(false);
  });
});

describe('extraerTexto', () => {
  it('saca el contenido de un fichero de texto', () => {
    const salida = extraerTexto(
      Buffer.from('Acta de inicio del contrato.'),
      'text/plain',
      'a.txt',
    );
    expect(salida).toEqual({ estado: 'EXTRAIDO', texto: 'Acta de inicio del contrato.' });
  });

  it('distingue un fichero vacío de uno que no se puede leer', () => {
    expect(extraerTexto(Buffer.from('   \n '), 'text/plain', 'a.txt').estado).toBe('VACIO');
  });

  it('dice por qué no puede con un PDF, en vez de inventarse el texto', () => {
    const salida = extraerTexto(Buffer.from('%PDF-1.7'), 'application/pdf', 'p.pdf');

    expect(salida.estado).toBe('NO_SOPORTADO');
    // Sacar las tiras ASCII de un binario produce basura verosímil, que es
    // justo lo que hace que una búsqueda deje de ser fiable.
    expect(salida).toHaveProperty('motivo');
  });

  it('descarta un binario que dice ser texto', () => {
    const binario = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x41, 0x42]);
    expect(extraerTexto(binario, 'text/plain', 'falso.txt').estado).toBe('NO_SOPORTADO');
  });

  it('trunca lo muy largo en vez de guardarlo entero', () => {
    const salida = extraerTexto(Buffer.from('a'.repeat(500_000)), 'text/plain', 'log.txt');
    expect(salida.estado).toBe('EXTRAIDO');
    if (salida.estado === 'EXTRAIDO') expect(salida.texto.length).toBe(200_000);
  });
});

describe('normalizarBusqueda', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizarBusqueda('Alcalá DE Henares')).toBe('alcala de henares');
  });
});

describe('fragmentoAlrededor', () => {
  const texto =
    'Primera línea del escrito. Se propone una penalidad por importe de 12.500 euros. Y sigue.';

  it('devuelve la parte donde aparece lo buscado', () => {
    const fragmento = fragmentoAlrededor(texto, 'penalidad', 20);
    expect(fragmento).toContain('penalidad');
  });

  it('encuentra sin tilde lo que está con tilde', () => {
    expect(fragmentoAlrededor('Trabajos en Alcalá de Henares', 'alcala')).toContain('Alcalá');
  });

  it('devuelve nulo si no aparece', () => {
    expect(fragmentoAlrededor(texto, 'subrogación')).toBeNull();
  });
});
