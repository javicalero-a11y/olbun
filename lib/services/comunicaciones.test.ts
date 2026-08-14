import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import type { TenantTransactionClient } from '@/lib/db/tenant';
import { guardarObjeto } from '@/lib/storage/objetos';

import {
  analizarArchivoComunicacion,
  analizarEml,
  analizarMsg,
  analizarPdf,
  guardarComunicacion,
  sanitizarHtml,
} from './comunicaciones';

vi.mock('@/lib/storage/objetos', () => ({
  guardarObjeto: vi.fn(),
}));

/** A minimal valid PDF, used to exercise the real extractor rather than a mock. */
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

/** A message shaped like the ones an administration actually sends. */
function eml(opciones: { asunto?: string; html?: string; messageId?: string } = {}): Buffer {
  const {
    asunto = 'Propuesta de penalidad',
    html,
    messageId = '<abc123@alcala.es>',
  } = opciones;

  const cabeceras = [
    'From: "Ayto. de Alcala" <contratacion@alcala.es>',
    'To: registro@guadaira.example, otro@guadaira.example',
    'Cc: interventor@alcala.es',
    `Subject: ${asunto}`,
    'Date: Mon, 02 Mar 2026 10:15:00 +0100',
    `Message-ID: ${messageId}`,
    'MIME-Version: 1.0',
  ];

  if (!html) {
    return Buffer.from(
      [...cabeceras, 'Content-Type: text/plain; charset=utf-8', '', 'Le informamos.'].join(
        '\r\n',
      ),
    );
  }

  return Buffer.from(
    [...cabeceras, 'Content-Type: text/html; charset=utf-8', '', html].join('\r\n'),
  );
}

describe('analizarEml', () => {
  it('saca remitente, destinatarios y asunto', async () => {
    const salida = await analizarEml(eml());

    expect(salida.de).toBe('contratacion@alcala.es');
    expect(salida.para).toEqual(['registro@guadaira.example', 'otro@guadaira.example']);
    expect(salida.cc).toEqual(['interventor@alcala.es']);
    expect(salida.asunto).toBe('Propuesta de penalidad');
  });

  it('conserva el Message-ID, que es la clave de deduplicación', async () => {
    const salida = await analizarEml(eml());
    expect(salida.messageIdRFC).toBe('<abc123@alcala.es>');
  });

  it('calcula una huella aunque no haya Message-ID', async () => {
    // El correo escaneado o reenviado a veces no trae ninguno.
    const sinId = Buffer.from(
      [
        'From: contratacion@alcala.es',
        'To: registro@guadaira.example',
        'Subject: Sin identificador',
        'Date: Mon, 02 Mar 2026 10:15:00 +0100',
        '',
        'Cuerpo.',
      ].join('\r\n'),
    );

    const salida = await analizarEml(sinId);
    expect(salida.huella).toHaveLength(64);
  });

  it('el mismo mensaje reenviado comparte huella', async () => {
    const original = await analizarEml(eml());
    const reenviado = await analizarEml(
      eml({ asunto: 'RV: Propuesta de penalidad', messageId: '<otro@outlook.com>' }),
    );

    // Message-ID distinto, mismo mensaje: la huella es lo que lo detecta.
    expect(reenviado.messageIdRFC).not.toBe(original.messageIdRFC);
    expect(reenviado.huella).toBe(original.huella);
  });

  it('extrae la fecha de envío', async () => {
    const salida = await analizarEml(eml());
    expect(salida.fechaEnvio?.toISOString()).toBe('2026-03-02T09:15:00.000Z');
  });
});

describe('sanitizarHtml', () => {
  it('elimina el script', () => {
    expect(sanitizarHtml('<p>Hola</p><script>alert(1)</script>')).not.toContain('script');
  });

  it('elimina las imágenes remotas, que son acuses de lectura', () => {
    // Un píxel de seguimiento en un correo de la parte contraria avisaría de
    // cuándo se ha leído su escrito.
    const salida = sanitizarHtml('<p>Hola</p><img src="https://rastreo.example/p.gif">');
    expect(salida).not.toContain('img');
    expect(salida).not.toContain('rastreo.example');
  });

  it('elimina los iframes y los formularios', () => {
    const salida = sanitizarHtml('<iframe src="x"></iframe><form action="y"></form>');
    expect(salida).not.toContain('iframe');
    expect(salida).not.toContain('form');
  });

  it('conserva el texto y el formato inofensivo', () => {
    const salida = sanitizarHtml('<p>Le <strong>informamos</strong> de la penalidad.</p>');
    expect(salida).toContain('informamos');
    expect(salida).toContain('<strong>');
  });

  it('se aplica al analizar, no al mostrar', async () => {
    const salida = await analizarEml(
      eml({
        html: '<p>Hola</p><script>alert(1)</script><img src="https://rastreo.example/p.gif">',
      }),
    );

    // Lo que se guarda ya viene limpio: no hay ninguna pantalla que pueda
    // olvidarse de sanear.
    expect(salida.cuerpoHtmlSanitizado).toBeDefined();
    expect(salida.cuerpoHtmlSanitizado).not.toContain('script');
    expect(salida.cuerpoHtmlSanitizado).not.toContain('rastreo.example');
  });
});

describe('analizarMsg', () => {
  it('lee un mensaje real exportado por Outlook', () => {
    const salida = analizarMsg(readFileSync('tests/fixtures/outlook-sent.msg'));

    expect(salida.asunto).toBe('Sent time');
    expect(salida.de).toBe('xmailuser@xmailserver.test');
    expect(salida.para).toEqual(['xmailuser@xmailserver.test']);
    expect(salida.cuerpoTexto).toContain('Test mail');
    expect(salida.fechaEnvio?.toISOString()).toBe('2021-02-15T08:19:04.000Z');
  });

  it('extrae y firma los adjuntos del contenedor', () => {
    const salida = analizarMsg(readFileSync('tests/fixtures/outlook-attachments.msg'));

    expect(salida.messageIdRFC).toContain('@hmailserver.test>');
    expect(salida.adjuntos).toHaveLength(3);
    expect(salida.adjuntos.map((adjunto) => adjunto.nombre)).toEqual([
      'jpg.jpg',
      'png.png',
      'tif.tif',
    ]);
    expect(salida.adjuntos.every((adjunto) => adjunto.sha256.length === 64)).toBe(true);
  });
});

describe('analizarPdf', () => {
  it('extrae el texto y conserva los metadatos que aporta la persona', async () => {
    const salida = await analizarPdf(
      pdfConTexto('Requerimiento de subsanacion contractual'),
      'requerimiento.pdf',
      { remitente: 'contratacion@ayuntamiento.es', asunto: 'Subsanación del contrato' },
    );

    expect(salida.de).toBe('contratacion@ayuntamiento.es');
    expect(salida.asunto).toBe('Subsanación del contrato');
    expect(salida.cuerpoTexto).toContain('Requerimiento de subsanacion contractual');
    expect(salida.huella).toHaveLength(64);
  });
});

describe('analizarArchivoComunicacion', () => {
  it('conserva los bytes exactos del archivo fuente como evidencia', async () => {
    const contenido = eml();
    const salida = await analizarArchivoComunicacion(contenido, {
      nombre: 'aviso.eml',
      mimeType: 'message/rfc822',
    });

    expect(salida.formato).toBe('EML');
    expect(salida.comunicacion.adjuntos[0]).toMatchObject({
      nombre: 'aviso.eml',
      mimeType: 'message/rfc822',
      tamano: contenido.byteLength,
    });
    expect(salida.comunicacion.adjuntos[0]?.contenido.equals(contenido)).toBe(true);
  });

  it('rechaza formatos que podrían disfrazar ejecutables', async () => {
    await expect(
      analizarArchivoComunicacion(Buffer.from('MZ'), {
        nombre: 'factura.exe',
        mimeType: 'application/octet-stream',
      }),
    ).rejects.toThrow('no es un .eml, .msg o PDF compatible');
  });
});

describe('guardarComunicacion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function baseAnalizada() {
    return {
      messageIdRFC: '<mensaje@ayuntamiento.es>',
      huella: 'a'.repeat(64),
      asunto: 'Requerimiento',
      de: 'contratacion@ayuntamiento.es',
      para: ['contratos@empresa.es'],
      cc: [],
      fechaEnvio: new Date('2026-03-02T09:15:00.000Z'),
      cuerpoTexto: 'Aporte la documentación.',
      cuerpoHtmlSanitizado: undefined,
      adjuntos: [
        {
          nombre: 'original.eml',
          mimeType: 'message/rfc822',
          tamano: 8,
          sha256: 'b'.repeat(64),
          contenido: Buffer.from('original'),
        },
      ],
    };
  }

  function dbFalso(opciones: {
    primera: { id: string } | null;
    segunda?: { id: string } | null;
    insertadas?: number;
  }) {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(opciones.primera)
      .mockResolvedValueOnce(opciones.segunda ?? null);
    const createMany = vi.fn().mockResolvedValue({ count: opciones.insertadas ?? 0 });
    const crearAdjunto = vi.fn().mockResolvedValue({ id: 'adjunto-1' });
    const db = {
      comunicacion: { findFirst, createMany },
      adjunto: { create: crearAdjunto },
    } as unknown as TenantTransactionClient;
    return { db, findFirst, createMany, crearAdjunto };
  }

  it('devuelve el registro existente sin volver a guardar sus archivos', async () => {
    const falso = dbFalso({ primera: { id: 'com-ya-existe' } });

    const salida = await guardarComunicacion(falso.db, 'org-1', 'buzon-1', baseAnalizada(), {
      direccion: 'ENTRANTE',
    });

    expect(salida).toEqual({ estado: 'DUPLICADA', comunicacionId: 'com-ya-existe' });
    expect(falso.createMany).not.toHaveBeenCalled();
    expect(guardarObjeto).not.toHaveBeenCalled();
  });

  it('conserva cada archivo sólo después de ganar la inserción única', async () => {
    const falso = dbFalso({ primera: null, segunda: { id: 'com-nueva' }, insertadas: 1 });
    vi.mocked(guardarObjeto).mockResolvedValueOnce({
      clave: 'org-1/sha256/archivo',
      sha256: 'b'.repeat(64),
      tamano: 8,
      yaExistia: false,
    });

    const salida = await guardarComunicacion(falso.db, 'org-1', 'buzon-1', baseAnalizada(), {
      direccion: 'ENTRANTE',
      contratoId: 'contrato-1',
      creadoPorId: 'persona-1',
    });

    expect(salida).toEqual({ estado: 'CREADA', comunicacionId: 'com-nueva' });
    expect(guardarObjeto).toHaveBeenCalledWith(
      'org-1',
      Buffer.from('original'),
      expect.objectContaining({ nombre: 'original.eml' }),
    );
    expect(falso.crearAdjunto).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: 'org-1',
        comunicacionId: 'com-nueva',
        storageKey: 'org-1/sha256/archivo',
        estadoAntivirus: 'PENDIENTE',
      }),
    });
  });

  it('resuelve una carrera por Message-ID aunque la huella de la copia sea distinta', async () => {
    const falso = dbFalso({ primera: null, segunda: { id: 'com-ganadora' }, insertadas: 0 });

    const salida = await guardarComunicacion(falso.db, 'org-1', 'buzon-1', baseAnalizada(), {
      direccion: 'ENTRANTE',
    });

    expect(salida).toEqual({ estado: 'DUPLICADA', comunicacionId: 'com-ganadora' });
    expect(falso.findFirst).toHaveBeenLastCalledWith({
      where: {
        OR: [{ messageIdRFC: '<mensaje@ayuntamiento.es>' }, { huella: 'a'.repeat(64) }],
      },
      select: { id: true },
    });
    expect(guardarObjeto).not.toHaveBeenCalled();
  });
});
