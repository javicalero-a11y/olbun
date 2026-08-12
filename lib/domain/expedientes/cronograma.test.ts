import { describe, expect, it } from 'vitest';

import { construirCronograma, marcasDeMes, type HitoCronograma } from './cronograma';
import type { FechaCivil } from '@/lib/domain/fecha';

const HOY: FechaCivil = '2026-03-10';

function hito(sobrescribe: Partial<HitoCronograma> = {}): HitoCronograma {
  return {
    id: 'h1',
    orden: 1,
    nombre: 'Recepción de la notificación',
    tipo: 'RECEPCION_NOTIFICACION',
    estado: 'CUMPLIDO',
    fechaReal: '2026-03-05',
    ...sobrescribe,
  };
}

describe('construirCronograma', () => {
  it('no devuelve nada cuando ningún hito tiene fecha', () => {
    const cronograma = construirCronograma(
      [hito({ fechaReal: undefined, fechaPrevista: undefined })],
      HOY,
    );
    expect(cronograma).toBeUndefined();
  });

  it('descarta los hitos sin fecha en lugar de inventarles una posición', () => {
    const cronograma = construirCronograma(
      [hito(), hito({ id: 'h2', orden: 2, fechaReal: undefined, fechaPrevista: undefined })],
      HOY,
    );

    expect(cronograma?.barras).toHaveLength(1);
    expect(cronograma?.barras[0]?.hitoId).toBe('h1');
  });

  it('ordena las barras por el orden del procedimiento, no por fecha', () => {
    const cronograma = construirCronograma(
      [
        hito({ id: 'tercero', orden: 3, fechaPrevista: '2026-03-08' }),
        hito({ id: 'primero', orden: 1, fechaPrevista: '2026-03-20' }),
      ],
      HOY,
    );

    expect(cronograma?.barras.map((b) => b.hitoId)).toEqual(['primero', 'tercero']);
  });

  it('un plazo ocupa una barra desde su inicio hasta su vencimiento', () => {
    const cronograma = construirCronograma(
      [
        hito({
          id: 'alegaciones',
          orden: 2,
          estado: 'PENDIENTE',
          plazo: {
            id: 'p1',
            fechaInicio: '2026-03-05',
            vencimiento: '2026-03-20',
            esPreclusivo: true,
            calculoCompleto: true,
            fundamento: 'art. 82.2 Ley 39/2015',
          },
        }),
      ],
      HOY,
    );

    const barra = cronograma?.barras[0];
    expect(barra?.desde).toBe('2026-03-05');
    expect(barra?.hasta).toBe('2026-03-20');
    expect(barra?.esPlazo).toBe(true);
    expect(barra?.esPreclusivo).toBe(true);
  });

  it('un hito de un solo día conserva un ancho visible y clicable', () => {
    const cronograma = construirCronograma(
      [
        hito({ fechaReal: '2026-03-05' }),
        hito({ id: 'lejano', orden: 2, fechaPrevista: '2026-09-30' }),
      ],
      HOY,
    );

    const puntual = cronograma?.barras.find((b) => b.hitoId === 'h1');
    expect(puntual?.desde).toBe(puntual?.hasta);
    expect(puntual?.anchoPct).toBeGreaterThan(1);
  });

  it('todas las barras caben dentro del marco', () => {
    const cronograma = construirCronograma(
      [
        hito({ fechaReal: '2026-03-05' }),
        hito({ id: 'h2', orden: 2, fechaPrevista: '2026-05-20' }),
        hito({ id: 'h3', orden: 3, fechaPrevista: '2026-08-01' }),
      ],
      HOY,
    );

    for (const barra of cronograma?.barras ?? []) {
      expect(barra.inicioPct).toBeGreaterThanOrEqual(0);
      expect(barra.inicioPct + barra.anchoPct).toBeLessThanOrEqual(100);
    }
  });

  it('mantiene el día de hoy dentro de la ventana aunque todo el expediente sea pasado', () => {
    const cronograma = construirCronograma(
      [
        hito({ fechaReal: '2025-01-10' }),
        hito({ id: 'h2', orden: 2, fechaReal: '2025-02-10' }),
      ],
      HOY,
    );

    expect(cronograma?.hoyPct).toBeGreaterThanOrEqual(0);
    expect(cronograma?.hoyPct).toBeLessThanOrEqual(100);
  });

  it('también cuando todo el expediente es futuro', () => {
    const cronograma = construirCronograma(
      [hito({ fechaPrevista: '2027-01-10', fechaReal: undefined })],
      HOY,
    );

    expect(cronograma?.hoyPct).toBeGreaterThanOrEqual(0);
    expect(cronograma?.hoyPct).toBeLessThanOrEqual(100);
  });

  it('la descripción accesible dice fechas y fundamento, no colores', () => {
    const cronograma = construirCronograma(
      [
        hito({
          nombre: 'Presentación de alegaciones',
          estado: 'PENDIENTE',
          fechaReal: undefined,
          plazo: {
            id: 'p1',
            fechaInicio: '2026-03-05',
            vencimiento: '2026-03-20',
            esPreclusivo: true,
            calculoCompleto: false,
            fundamento: 'art. 82.2 Ley 39/2015',
          },
        }),
      ],
      HOY,
    );

    const texto = cronograma?.barras[0]?.descripcionAccesible ?? '';
    expect(texto).toContain('Presentación de alegaciones');
    expect(texto).toContain('05/03/2026');
    expect(texto).toContain('20/03/2026');
    expect(texto).toContain('art. 82.2 Ley 39/2015');
    expect(texto).toContain('preclusivo');
    expect(texto).toContain('sin verificar');
  });

  it('distingue lo cumplido de lo previsto al describirlo', () => {
    const cumplido = construirCronograma([hito({ fechaReal: '2026-03-05' })], HOY);
    const previsto = construirCronograma(
      [hito({ fechaReal: undefined, fechaPrevista: '2026-03-25' })],
      HOY,
    );

    expect(cumplido?.barras[0]?.descripcionAccesible).toContain('cumplido el');
    expect(previsto?.barras[0]?.descripcionAccesible).toContain('previsto para el');
  });

  it('la fecha real manda sobre la prevista cuando existen las dos', () => {
    const cronograma = construirCronograma(
      [hito({ fechaPrevista: '2026-03-20', fechaReal: '2026-03-18' })],
      HOY,
    );

    expect(cronograma?.barras[0]?.desde).toBe('2026-03-18');
  });
});

describe('marcasDeMes', () => {
  it('pone una marca en el día 1 de cada mes de la ventana', () => {
    const marcas = marcasDeMes('2026-02-20', '2026-05-10', 79);
    expect(marcas.map((m) => m.fecha)).toEqual(['2026-03-01', '2026-04-01', '2026-05-01']);
  });

  it('sólo muestra el año en enero, que es cuando cambia', () => {
    const marcas = marcasDeMes('2025-12-20', '2026-02-10', 52);
    expect(marcas.map((m) => m.etiqueta)).toEqual(['ene 2026', 'feb']);
  });

  it('no devuelve marcas si la ventana no llega a cruzar un cambio de mes', () => {
    expect(marcasDeMes('2026-03-05', '2026-03-20', 15)).toEqual([]);
  });
});
