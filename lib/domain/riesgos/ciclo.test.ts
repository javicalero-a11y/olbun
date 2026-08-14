import { describe, expect, it } from 'vitest';

import { valorar } from './matriz';
import {
  erroresCambioAccion,
  erroresCierreIncidencia,
  erroresValoracionResidual,
  puedeCambiarAccion,
  puedeCambiarIncidencia,
  proximaRevisionDesde,
  situacionRevision,
} from './ciclo';

describe('ciclo de la acción correctora', () => {
  it('permite el recorrido normal y una reapertura antes de verificar', () => {
    expect(puedeCambiarAccion('PENDIENTE', 'EN_CURSO')).toBe(true);
    expect(puedeCambiarAccion('EN_CURSO', 'COMPLETADA')).toBe(true);
    expect(puedeCambiarAccion('COMPLETADA', 'EN_CURSO')).toBe(true);
    expect(puedeCambiarAccion('COMPLETADA', 'VERIFICADA')).toBe(true);
  });

  it('mantiene terminales los estados verificado y cancelado', () => {
    expect(puedeCambiarAccion('VERIFICADA', 'EN_CURSO')).toBe(false);
    expect(puedeCambiarAccion('CANCELADA', 'PENDIENTE')).toBe(false);
  });

  it('exige bloqueo explicado, progreso válido y verificación eficaz', () => {
    expect(
      erroresCambioAccion({
        actual: 'EN_CURSO',
        siguiente: 'BLOQUEADA',
        progreso: 101,
        motivoBloqueo: 'no',
      }),
    ).toHaveLength(2);
    expect(
      erroresCambioAccion({
        actual: 'COMPLETADA',
        siguiente: 'VERIFICADA',
        progreso: 100,
        eficacia: 'Funcionó y no se ha repetido en el periodo de prueba.',
      }),
    ).toEqual([]);
  });
});

describe('valoración residual', () => {
  it('no necesita explicación adicional cuando mejora o se mantiene', () => {
    expect(erroresValoracionResidual(valorar(4, 4), valorar(2, 3), '')).toEqual([]);
    expect(erroresValoracionResidual(valorar(3, 3), valorar(3, 3), '')).toEqual([]);
  });

  it('obliga a justificar una valoración residual peor', () => {
    expect(erroresValoracionResidual(valorar(2, 2), valorar(4, 4), '')).toHaveLength(1);
    expect(
      erroresValoracionResidual(
        valorar(2, 2),
        valorar(4, 4),
        'Ha aparecido información nueva durante la investigación.',
      ),
    ).toEqual([]);
  });
});

describe('cadencia de revisión', () => {
  it('calcula con fechas civiles, sin depender de horario de verano', () => {
    expect(proximaRevisionDesde('2026-03-28', 7)).toBe('2026-04-04');
  });

  it('rechaza frecuencias fuera del rango operativo', () => {
    expect(() => proximaRevisionDesde('2026-01-01', 0)).toThrow('1 y 3.650');
    expect(() => proximaRevisionDesde('2026-01-01', 3651)).toThrow('1 y 3.650');
  });

  it('distingue vencida, hoy, futura y no programada', () => {
    expect(situacionRevision(null, '2026-08-14')).toBe('SIN_FECHA');
    expect(situacionRevision('2026-08-13', '2026-08-14')).toBe('VENCIDA');
    expect(situacionRevision('2026-08-14', '2026-08-14')).toBe('VENCE_HOY');
    expect(situacionRevision('2026-08-15', '2026-08-14')).toBe('AL_DIA');
  });
});

describe('cierre de incidencias', () => {
  it('solo reabre una incidencia que ya estaba cerrada', () => {
    expect(puedeCambiarIncidencia('ABIERTA', 'REABIERTA')).toBe(false);
    expect(puedeCambiarIncidencia('CERRADA', 'REABIERTA')).toBe(true);
    expect(puedeCambiarIncidencia('REABIERTA', 'EN_INVESTIGACION')).toBe(true);
  });

  it('siempre exige una causa raíz útil', () => {
    expect(erroresCierreIncidencia('LEVE', 'corto', undefined)).toHaveLength(1);
    expect(
      erroresCierreIncidencia('LEVE', 'Fallo de la lista de comprobación.', undefined),
    ).toEqual([]);
  });

  it('en graves exige además lecciones aprendidas', () => {
    expect(
      erroresCierreIncidencia('GRAVE', 'Fallo de supervisión del turno.', undefined),
    ).toHaveLength(1);
    expect(
      erroresCierreIncidencia(
        'MUY_GRAVE',
        'Fallo de supervisión del turno.',
        'Se implantó una doble confirmación antes de iniciar el servicio.',
      ),
    ).toEqual([]);
  });
});
