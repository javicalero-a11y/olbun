import { describe, expect, it } from 'vitest';

import {
  cargaConNuevaAdscripcion,
  coberturaBasePorCategoria,
  seSolapan,
} from './adscripciones';
import { estadoDeCertificacion } from './caducidades';
import { esNifONieValido, normalizarNif } from './identificadores';
import { precioHoraOrdinaria, salarioBaseAnual } from './salarios';

describe('tablas salariales', () => {
  it('calcula anual y precio por hora con la precisión publicada', () => {
    const tabla = { salarioBaseMensual: 1_250.55, numeroPagas: 14, jornadaAnualHoras: 1_792 };
    expect(salarioBaseAnual(tabla)).toBe(17_507.7);
    expect(precioHoraOrdinaria(tabla)).toBe(9.7699);
  });

  it('rechaza pagas y jornadas imposibles', () => {
    expect(() =>
      salarioBaseAnual({ salarioBaseMensual: 1, numeroPagas: 0, jornadaAnualHoras: 1 }),
    ).toThrow(RangeError);
    expect(() =>
      precioHoraOrdinaria({ salarioBaseMensual: 1, numeroPagas: 12, jornadaAnualHoras: 0 }),
    ).toThrow(RangeError);
  });
});

describe('caducidad de certificados', () => {
  it.each([
    [undefined, 'VALIDA'],
    ['2026-08-13', 'CADUCADA'],
    ['2026-08-14', 'PROXIMA_A_CADUCAR'],
    ['2026-11-12', 'PROXIMA_A_CADUCAR'],
    ['2026-11-13', 'VALIDA'],
  ] as const)('clasifica %s como %s', (fecha, estado) => {
    expect(estadoDeCertificacion(fecha, '2026-08-14', 90)).toBe(estado);
  });
});

describe('adscripción y cobertura base', () => {
  const base = {
    porcentajeDedicacion: 60,
    fechaAlta: '2026-01-01' as const,
    fechaBaja: '2026-06-30' as const,
  };

  it('considera inclusivos los extremos de una adscripción', () => {
    expect(seSolapan(base, { porcentajeDedicacion: 50, fechaAlta: '2026-06-30' })).toBe(true);
    expect(seSolapan(base, { porcentajeDedicacion: 50, fechaAlta: '2026-07-01' })).toBe(false);
  });

  it('avisa sobre 100 y bloquea sobre 150', () => {
    expect(
      cargaConNuevaAdscripcion([base], { porcentajeDedicacion: 50, fechaAlta: '2026-06-01' }),
    ).toEqual({ total: 110, superaJornada: true, bloqueada: false });
    expect(
      cargaConNuevaAdscripcion([base], { porcentajeDedicacion: 91, fechaAlta: '2026-06-01' }),
    ).toEqual({ total: 151, superaJornada: true, bloqueada: true });
  });

  it('no permite que una categoría compense el déficit de otra', () => {
    const cobertura = coberturaBasePorCategoria(
      [
        { categoriaId: 'oficial', centroTrabajo: 'Centro A', horas: 40 },
        { categoriaId: 'peon', centroTrabajo: 'Centro A', horas: 40 },
      ],
      [
        { categoriaId: 'oficial', centroTrabajo: 'Centro A', horas: 20 },
        { categoriaId: 'peon', centroTrabajo: 'Centro A', horas: 60 },
      ],
    );
    expect(cobertura.find((fila) => fila.categoriaId === 'oficial')).toMatchObject({
      deficit: 20,
      porcentaje: 50,
    });
    expect(cobertura.find((fila) => fila.categoriaId === 'peon')).toMatchObject({
      deficit: 0,
      porcentaje: 150,
    });
  });
});

describe('NIF y NIE', () => {
  it('normaliza y valida el dígito de control', () => {
    expect(normalizarNif(' 12.345.678-z ')).toBe('12345678Z');
    expect(esNifONieValido('12345678Z')).toBe(true);
    expect(esNifONieValido('X2482300W')).toBe(true);
    expect(esNifONieValido('12345678A')).toBe(false);
  });
});
