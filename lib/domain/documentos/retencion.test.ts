import { describe, expect, it } from 'vitest';

import { DIAS_DE_AVISO, evaluarRetencion, explicarRetencion, sumarAnios } from './retencion';

const inicio = new Date('2020-03-01T00:00:00.000Z');

function evaluar(
  hoy: string,
  opciones: { retencionAnios?: number | null; bloqueadoPorLitigio?: boolean } = {},
) {
  return evaluarRetencion({
    inicio,
    retencionAnios: opciones.retencionAnios === undefined ? 6 : opciones.retencionAnios,
    bloqueadoPorLitigio: opciones.bloqueadoPorLitigio ?? false,
    hoy: new Date(`${hoy}T00:00:00.000Z`),
  });
}

describe('sumarAnios', () => {
  it('suma años naturales', () => {
    expect(sumarAnios(inicio, 6).toISOString()).toBe('2026-03-01T00:00:00.000Z');
  });

  it('el 29 de febrero cae al 28, no al 1 de marzo', () => {
    // Rodar al 1 de marzo alargaría la conservación un día por encima de lo que
    // permite la ley, y cuando la obligación es borrar, ese es el lado malo por
    // el que equivocarse.
    const bisiesto = new Date('2020-02-29T00:00:00.000Z');
    expect(sumarAnios(bisiesto, 1).toISOString()).toBe('2021-02-28T00:00:00.000Z');
    expect(sumarAnios(bisiesto, 4).toISOString()).toBe('2024-02-29T00:00:00.000Z');
  });
});

describe('evaluarRetencion', () => {
  it('cuenta los días que quedan mientras está en plazo', () => {
    const salida = evaluar('2021-03-01');

    expect(salida.estado).toBe('EN_PLAZO');
    expect(salida.caducaEl?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(salida.purgable).toBe(false);
  });

  it('avisa desde noventa días antes', () => {
    expect(evaluar('2025-12-02').estado).toBe('POR_CADUCAR');
    expect(evaluar('2025-12-02').diasRestantes).toBe(DIAS_DE_AVISO - 1);
    expect(evaluar('2025-11-30').estado).toBe('EN_PLAZO');
  });

  it('el último día todavía está en plazo; al siguiente caduca', () => {
    expect(evaluar('2026-02-28').estado).toBe('POR_CADUCAR');
    expect(evaluar('2026-03-01').estado).toBe('CADUCADO');
    expect(evaluar('2026-03-01').purgable).toBe(true);
    expect(evaluar('2026-03-02').diasRestantes).toBe(-1);
  });

  it('el litigio gana a cualquier plazo cumplido', () => {
    const salida = evaluar('2030-01-01', { bloqueadoPorLitigio: true });

    expect(salida.estado).toBe('BLOQUEADO');
    expect(salida.purgable).toBe(false);
    // Sin fecha: enseñar una que no se va a respetar es peor que no enseñar
    // ninguna.
    expect(salida.caducaEl).toBeNull();
  });

  it('sin política no es lo mismo que para siempre, y ninguna se purga', () => {
    const sinPolitica = evaluar('2030-01-01', { retencionAnios: null });
    const permanente = evaluar('2030-01-01', { retencionAnios: 0 });

    expect(sinPolitica.estado).toBe('SIN_POLITICA');
    expect(permanente.estado).toBe('PERMANENTE');
    expect(sinPolitica.purgable).toBe(false);
    expect(permanente.purgable).toBe(false);
  });
});

describe('explicarRetencion', () => {
  it('dice por qué, no sólo cuándo', () => {
    expect(explicarRetencion(evaluar('2026-03-11'))).toMatch(/Caducó hace 10 días/);
    expect(explicarRetencion(evaluar('2030-01-01', { bloqueadoPorLitigio: true }))).toMatch(
      /litigio/,
    );
  });
});
