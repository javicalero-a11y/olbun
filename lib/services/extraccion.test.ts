import { describe, expect, it } from 'vitest';

import { esPdf, extraerTextoDeArchivo } from './extraccion';

/**
 * Runs against a real PDF built here rather than a mocked parser: the thing
 * worth checking is that the words come back out, and a mock that returns the
 * words we put in proves nothing at all.
 */

/** A minimal, valid PDF with one line of text in it. */
function pdfConTexto(texto: string): Buffer {
  const contenido = `BT /F1 12 Tf 72 720 Td (${texto}) Tj ET`;
  const objetos = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${String(contenido.length)} >>\nstream\n${contenido}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const posiciones: number[] = [];

  for (const objeto of objetos) {
    posiciones.push(pdf.length);
    pdf += objeto;
  }

  const inicioXref = pdf.length;
  pdf += `xref\n0 ${String(objetos.length + 1)}\n0000000000 65535 f \n`;
  for (const posicion of posiciones) {
    pdf += `${String(posicion).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${String(objetos.length + 1)} /Root 1 0 R >>\nstartxref\n${String(inicioXref)}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}

describe('esPdf', () => {
  it('lo reconoce por el tipo y por la extensión', () => {
    expect(esPdf('application/pdf', 'x')).toBe(true);
    expect(esPdf('application/octet-stream', 'PLIEGO.PDF')).toBe(true);
    expect(esPdf('text/plain', 'nota.txt')).toBe(false);
  });
});

describe('extraerTextoDeArchivo', () => {
  it('saca el texto de un PDF de verdad', async () => {
    const salida = await extraerTextoDeArchivo(
      pdfConTexto('Propuesta de penalidad por incidencias'),
      'application/pdf',
      'penalidad.pdf',
    );

    expect(salida.estado).toBe('EXTRAIDO');
    if (salida.estado === 'EXTRAIDO') {
      expect(salida.texto).toContain('Propuesta de penalidad');
    }
  });

  it('dice que un PDF sin texto necesita OCR, en vez de indexarlo vacío', async () => {
    // Un PDF válido y sin texto es, casi siempre, un escaneado. Guardarlo como
    // indexado haría creer que se ha buscado dentro cuando no hay nada dentro.
    const salida = await extraerTextoDeArchivo(pdfConTexto(''), 'application/pdf', 'escan.pdf');

    expect(salida.estado).toBe('NO_SOPORTADO');
    if (salida.estado === 'NO_SOPORTADO') expect(salida.motivo).toMatch(/OCR/);
  });

  it('un PDF ilegible no rompe la subida', async () => {
    const salida = await extraerTextoDeArchivo(
      Buffer.from('%PDF-1.4 esto no es un PDF'),
      'application/pdf',
      'roto.pdf',
    );

    expect(salida.estado).toBe('NO_SOPORTADO');
  });

  it('sigue leyendo los ficheros de texto como antes', async () => {
    const salida = await extraerTextoDeArchivo(
      Buffer.from('Acta de inicio.'),
      'text/plain',
      'acta.txt',
    );

    expect(salida).toEqual({ estado: 'EXTRAIDO', texto: 'Acta de inicio.' });
  });
});
