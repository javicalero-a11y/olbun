import { describe, expect, it } from 'vitest';

import { analizarEml, sanitizarHtml } from './comunicaciones';

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
