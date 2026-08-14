import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { reconocerPdf } from './ocr';

async function pdfEscaneado(): Promise<Buffer> {
  const lienzo = createCanvas(1200, 360);
  const contexto = lienzo.getContext('2d');
  contexto.fillStyle = '#ffffff';
  contexto.fillRect(0, 0, 1200, 360);
  contexto.fillStyle = '#000000';
  contexto.font = 'bold 86px sans-serif';
  contexto.fillText('EXPEDIENTE 2026', 90, 215);
  const png = await lienzo.encode('png');

  const pdf = await PDFDocument.create();
  const imagen = await pdf.embedPng(png);
  const pagina = pdf.addPage([1200, 360]);
  pagina.drawImage(imagen, { x: 0, y: 0, width: 1200, height: 360 });
  return Buffer.from(await pdf.save());
}

describe('reconocerPdf', () => {
  it('lee localmente un PDF escaneado con el modelo español', async () => {
    const resultado = await reconocerPdf(await pdfEscaneado(), 1);

    expect(resultado.texto).toMatch(/EXPEDIENTE\s+2026/iu);
    expect(resultado.paginasProcesadas).toBe(1);
    expect(resultado.paginasTotales).toBe(1);
    expect(resultado.completo).toBe(true);
    expect(resultado.confianza).not.toBeNull();
  }, 30_000);
});
