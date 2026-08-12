import { describe, expect, it } from 'vitest';

import { avisoMasUrgente, avisosDePlazos, evaluarPlazo, type PlazoEvaluable } from './avisos';
import type { FechaCivil } from '@/lib/domain/fecha';

const HOY: FechaCivil = '2026-03-10';

function plazo(sobrescribe: Partial<PlazoEvaluable> = {}): PlazoEvaluable {
  return {
    id: 'p1',
    descripcion: 'Presentación de alegaciones',
    fundamento: 'art. 82.2 Ley 39/2015',
    cantidad: 10,
    computo: 'HABILES_ADMINISTRATIVO',
    fechaInicio: '2026-03-01',
    fechaVencimientoCalculada: '2026-03-20',
    esPreclusivo: false,
    calculoCompleto: true,
    advertencias: [],
    estado: 'VIGENTE',
    ...sobrescribe,
  };
}

describe('evaluarPlazo', () => {
  it('cuenta los días que faltan hasta el vencimiento', () => {
    const aviso = evaluarPlazo(plazo({ fechaVencimientoCalculada: '2026-03-20' }), HOY);
    expect(aviso.diasRestantes).toBe(10);
  });

  it('marca como vencido lo que ya pasó, con días negativos', () => {
    const aviso = evaluarPlazo(plazo({ fechaVencimientoCalculada: '2026-03-04' }), HOY);
    expect(aviso.nivel).toBe('VENCIDO');
    expect(aviso.diasRestantes).toBe(-6);
  });

  it('la fecha confirmada por una persona prevalece sobre la calculada', () => {
    const aviso = evaluarPlazo(
      plazo({
        fechaVencimientoCalculada: '2026-03-20',
        fechaVencimientoConfirmada: '2026-03-23',
      }),
      HOY,
    );
    expect(aviso.vencimiento).toBe('2026-03-23');
    expect(aviso.diasRestantes).toBe(13);
    expect(aviso.provisional).toBe(false);
  });

  it('gradúa un plazo preclusivo mucho más severamente que uno ordinario', () => {
    const dentroDeOchoDias = { fechaVencimientoCalculada: '2026-03-18' as FechaCivil };

    expect(evaluarPlazo(plazo({ ...dentroDeOchoDias, esPreclusivo: true }), HOY).nivel).toBe(
      'ALTO',
    );
    expect(evaluarPlazo(plazo({ ...dentroDeOchoDias, esPreclusivo: false }), HOY).nivel).toBe(
      'MEDIO',
    );
  });

  it('a tres días, un plazo preclusivo es crítico', () => {
    const aviso = evaluarPlazo(
      plazo({ fechaVencimientoCalculada: '2026-03-13', esPreclusivo: true }),
      HOY,
    );
    expect(aviso.nivel).toBe('CRITICO');
  });

  it('siempre incluye el fundamento jurídico en el detalle', () => {
    const aviso = evaluarPlazo(plazo(), HOY);
    expect(aviso.detalle).toContain('art. 82.2 Ley 39/2015');
  });

  it('avisa cuando el cálculo se apoya en calendarios sin verificar', () => {
    const aviso = evaluarPlazo(plazo({ calculoCompleto: false }), HOY);
    expect(aviso.detalle).toContain('sin verificar');
  });

  it('un cálculo incompleto no rebaja el nivel: lo mantiene y añade la advertencia', () => {
    const critico = { fechaVencimientoCalculada: '2026-03-11' as FechaCivil };

    const completo = evaluarPlazo(plazo({ ...critico, calculoCompleto: true }), HOY);
    const incompleto = evaluarPlazo(plazo({ ...critico, calculoCompleto: false }), HOY);

    expect(incompleto.nivel).toBe(completo.nivel);
    expect(incompleto.nivel).toBe('CRITICO');
    expect(incompleto.detalle.length).toBeGreaterThan(completo.detalle.length);
  });

  it('advierte de la preclusión con todas las letras', () => {
    const aviso = evaluarPlazo(plazo({ esPreclusivo: true }), HOY);
    expect(aviso.detalle).toContain('se pierde el derecho');
  });

  it('arrastra las advertencias que emitió el motor de cómputo', () => {
    const aviso = evaluarPlazo(
      plazo({ advertencias: ['El calendario local de 2026 no está cargado.'] }),
      HOY,
    );
    expect(aviso.detalle).toContain('calendario local de 2026');
  });

  it('no considera aviso un plazo ya cumplido, aunque su fecha haya pasado', () => {
    const aviso = evaluarPlazo(
      plazo({ fechaVencimientoCalculada: '2026-03-01', estado: 'CUMPLIDO' }),
      HOY,
    );
    expect(aviso.nivel).toBe('CERRADO');
  });

  it('tampoco lo considera si está suspendido', () => {
    expect(evaluarPlazo(plazo({ estado: 'SUSPENDIDO' }), HOY).nivel).toBe('CERRADO');
  });
});

describe('avisosDePlazos', () => {
  it('ordena lo vencido primero y, dentro de lo vencido, el incumplimiento más antiguo', () => {
    const avisos = avisosDePlazos(
      [
        plazo({ id: 'proximo', fechaVencimientoCalculada: '2026-03-12' }),
        plazo({ id: 'vencido-reciente', fechaVencimientoCalculada: '2026-03-08' }),
        plazo({ id: 'vencido-antiguo', fechaVencimientoCalculada: '2026-01-15' }),
      ],
      HOY,
    );

    expect(avisos.map((a) => a.plazoId)).toEqual([
      'vencido-antiguo',
      'vencido-reciente',
      'proximo',
    ]);
  });

  it('un preclusivo lejano pesa más que uno ordinario algo más cercano', () => {
    const avisos = avisosDePlazos(
      [
        plazo({
          id: 'ordinario',
          fechaVencimientoCalculada: '2026-03-19',
          esPreclusivo: false,
        }),
        plazo({
          id: 'preclusivo',
          fechaVencimientoCalculada: '2026-03-20',
          esPreclusivo: true,
        }),
      ],
      HOY,
    );

    expect(avisos[0]?.plazoId).toBe('preclusivo');
  });

  it('deja los cerrados al final', () => {
    const avisos = avisosDePlazos(
      [
        plazo({ id: 'cumplido', estado: 'CUMPLIDO', fechaVencimientoCalculada: '2026-01-01' }),
        plazo({ id: 'vigente', fechaVencimientoCalculada: '2026-04-30' }),
      ],
      HOY,
    );

    expect(avisos.map((a) => a.plazoId)).toEqual(['vigente', 'cumplido']);
  });
});

describe('avisoMasUrgente', () => {
  it('no devuelve nada cuando no hay plazos', () => {
    expect(avisoMasUrgente([], HOY)).toBeUndefined();
  });

  it('ignora los cerrados aunque sean los únicos', () => {
    expect(avisoMasUrgente([plazo({ estado: 'CUMPLIDO' })], HOY)).toBeUndefined();
  });

  it('devuelve el más urgente de todos', () => {
    const aviso = avisoMasUrgente(
      [
        plazo({ id: 'lejano', fechaVencimientoCalculada: '2026-06-01' }),
        plazo({ id: 'urgente', fechaVencimientoCalculada: '2026-03-11' }),
      ],
      HOY,
    );
    expect(aviso?.plazoId).toBe('urgente');
  });
});
