import { describe, expect, it } from 'vitest';

import { esPdf, esWord, extraerTextoDeArchivo } from './extraccion';

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

/**
 * A minimal, valid .docx: a zip with the three parts Word insists on. Built
 * here for the same reason as the PDF above — a mocked mammoth would only
 * prove that mammoth was called.
 */
async function docxConParrafos(parrafos: readonly string[]): Promise<Buffer> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>',
  );

  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>',
  );

  const cuerpo = parrafos
    .map((parrafo) => `<w:p><w:r><w:t xml:space="preserve">${parrafo}</w:t></w:r></w:p>`)
    .join('');

  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      `<w:body>${cuerpo}</w:body></w:document>`,
  );

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('esWord', () => {
  it('lo reconoce por el tipo y por la extensión', () => {
    expect(
      esWord('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'x'),
    ).toBe(true);
    expect(esWord('application/octet-stream', 'ALEGACIONES.DOCX')).toBe(true);
  });

  it('no reclama los .doc antiguos, que son otro formato', () => {
    expect(esWord('application/msword', 'alegaciones.doc')).toBe(false);
  });
});

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

  it('saca el texto de un .docx de verdad', async () => {
    const salida = await extraerTextoDeArchivo(
      await docxConParrafos([
        'ALEGACIONES AL REQUERIMIENTO',
        'Se impone una penalidad de 12.500,00 euros.',
      ]),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'alegaciones.docx',
    );

    expect(salida.estado).toBe('EXTRAIDO');
    if (salida.estado === 'EXTRAIDO') {
      expect(salida.texto).toContain('ALEGACIONES AL REQUERIMIENTO');
      // Los párrafos no se pegan entre sí: el importe tiene que poder citarse.
      expect(salida.texto).toContain('penalidad de 12.500,00 euros');
    }
  });

  it('un .docx vacío se marca como vacío, no como ilegible', async () => {
    const salida = await extraerTextoDeArchivo(
      await docxConParrafos([]),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'vacio.docx',
    );

    expect(salida).toEqual({ estado: 'VACIO' });
  });

  it('un .docx ilegible no rompe la subida', async () => {
    const salida = await extraerTextoDeArchivo(
      Buffer.from('PK esto no es un docx'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'roto.docx',
    );

    expect(salida.estado).toBe('NO_SOPORTADO');
  });

  it('los .doc antiguos siguen diciendo que necesitan su propio extractor', async () => {
    const salida = await extraerTextoDeArchivo(
      Buffer.from([0xd0, 0xcf, 0x11, 0xe0]),
      'application/msword',
      'viejo.doc',
    );

    expect(salida.estado).toBe('NO_SOPORTADO');
    if (salida.estado === 'NO_SOPORTADO') expect(salida.motivo).toMatch(/\.doc/);
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
