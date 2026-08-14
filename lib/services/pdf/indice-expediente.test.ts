import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { crearIndicePdfExpediente } from './indice-expediente';

describe('crearIndicePdfExpediente', () => {
  it('crea un PDF válido, paginado y con metadatos', async () => {
    const contenido = await crearIndicePdfExpediente({
      referencia: 'EXP-2026-0042',
      titulo: 'Recurso especial frente a penalidad',
      generadoEn: new Date('2026-08-14T12:00:00Z'),
      lineas: [
        '## Ficha',
        '- Órgano competente: Tribunal Administrativo de Recursos Contractuales',
        '## Plazos',
        ...Array.from(
          { length: 90 },
          (_, indice) =>
            `- Actuación ${String(indice + 1)}: vencimiento confirmado y huella documental.`,
        ),
      ],
    });

    expect(contenido.subarray(0, 4).toString()).toBe('%PDF');
    const pdf = await PDFDocument.load(contenido);
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toBe('Expediente EXP-2026-0042');
  });
});
