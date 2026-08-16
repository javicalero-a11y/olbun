import { describe, expect, it } from 'vitest';

import {
  construirFila,
  ETIQUETAS_CELDA,
  HORAS_MINIMAS_PARA_PROYECTAR,
  HORAS_SEMANA_COMPLETA,
  lunesDe,
  proyectarCobertura,
  semanasDe,
} from './planificador';
import type { AdscripcionParaCobertura, AusenciaParaCobertura, Periodo } from './ausencias';
import type { FechaCivil } from '../fecha';

const f = (valor: string) => valor as FechaCivil;
const etiqueta = () => 'IT por contingencia común';

/** 2026-06-01 es lunes. */
const junio: Periodo = { desde: f('2026-06-01'), hasta: f('2026-06-28') };

describe('lunesDe', () => {
  it('devuelve el lunes de esa semana', () => {
    expect(lunesDe(f('2026-06-03'))).toBe('2026-06-01');
    expect(lunesDe(f('2026-06-01'))).toBe('2026-06-01');
  });

  it('el domingo pertenece a la semana que acaba, no a la que empieza', () => {
    // Con la convención ISO el domingo es el último día: tratarlo como el
    // primero correría toda la rejilla una semana.
    expect(lunesDe(f('2026-06-07'))).toBe('2026-06-01');
    expect(lunesDe(f('2026-06-08'))).toBe('2026-06-08');
  });
});

describe('semanasDe', () => {
  it('parte el periodo en semanas de lunes a domingo', () => {
    const semanas = semanasDe(junio);

    expect(semanas).toHaveLength(4);
    expect(semanas[0]?.desde).toBe('2026-06-01');
    expect(semanas[0]?.hasta).toBe('2026-06-07');
    expect(semanas[0]?.laborables).toBe(5);
  });

  it('descuenta los festivos de los días laborables', () => {
    const semanas = semanasDe(junio, new Set(['2026-06-02']));
    expect(semanas[0]?.laborables).toBe(4);
  });

  it('empieza en el lunes anterior si el periodo arranca a media semana', () => {
    const semanas = semanasDe({ desde: f('2026-06-03'), hasta: f('2026-06-10') });
    expect(semanas[0]?.desde).toBe('2026-06-01');
  });
});

describe('construirFila', () => {
  const semanas = semanasDe(junio);

  const adscripcion: AdscripcionParaCobertura = {
    empleadoId: 'e1',
    categoriaId: 'cat',
    centroTrabajo: 'Centro Norte',
    horasSemanales: 40,
    periodo: { desde: f('2026-01-01'), hasta: f('2026-12-31') },
  };

  it('una jornada completa sin ausencias queda cubierta', () => {
    const fila = construirFila('e1', 'Rosa Vega', semanas, [adscripcion], [], etiqueta);

    expect(fila.celdas[0]?.comprometidas).toBe(40);
    expect(fila.celdas[0]?.disponibles).toBe(40);
    expect(fila.celdas[0]?.estado).toBe('CUBIERTO');
    expect(fila.tieneSobreasignacion).toBe(false);
  });

  it('sin adscripción la semana está libre, no cubierta a cero', () => {
    const fila = construirFila('e1', 'Rosa Vega', semanas, [], [], etiqueta);
    expect(fila.celdas[0]?.estado).toBe('LIBRE');
  });

  it('una ausencia se lleva su parte de la semana y la marca', () => {
    const baja: AusenciaParaCobertura = {
      empleadoId: 'e1',
      tipo: 'IT_CONTINGENCIA_COMUN',
      periodo: { desde: f('2026-06-01'), hasta: f('2026-06-02') },
    };

    const fila = construirFila('e1', 'Rosa Vega', semanas, [adscripcion], [baja], etiqueta);

    // Dos de cinco días laborables: 16 de las 40 horas.
    expect(fila.celdas[0]?.ausentes).toBe(16);
    expect(fila.celdas[0]?.disponibles).toBe(24);
    expect(fila.celdas[0]?.estado).toBe('AUSENTE');
    expect(fila.celdas[0]?.motivos).toEqual(['IT por contingencia común']);
    // La semana siguiente no se contagia.
    expect(fila.celdas[1]?.estado).toBe('CUBIERTO');
  });

  it('marca la sobreasignación, que es lo que una lista no enseña', () => {
    // Dos contratos al 60 % no chocan en ninguna pantalla hasta que se suman.
    const segunda: AdscripcionParaCobertura = { ...adscripcion, horasSemanales: 24 };
    const fila = construirFila(
      'e1',
      'Rosa Vega',
      semanas,
      [{ ...adscripcion, horasSemanales: 24 }, segunda],
      [],
      etiqueta,
    );

    expect(fila.celdas[0]?.comprometidas).toBe(48);
    expect(fila.celdas[0]?.estado).toBe('SOBREASIGNADO');
    expect(fila.tieneSobreasignacion).toBe(true);
    expect(HORAS_SEMANA_COMPLETA).toBe(40);
  });

  it('la sobreasignación gana a la ausencia: el plan no cuadra igualmente', () => {
    const baja: AusenciaParaCobertura = {
      empleadoId: 'e1',
      tipo: 'VACACIONES',
      periodo: { desde: f('2026-06-01'), hasta: f('2026-06-07') },
    };

    const fila = construirFila(
      'e1',
      'Rosa Vega',
      semanas,
      [{ ...adscripcion, horasSemanales: 50 }],
      [baja],
      etiqueta,
    );

    expect(fila.celdas[0]?.estado).toBe('SOBREASIGNADO');
  });

  it('la ausencia de otra persona no toca esta fila', () => {
    const ajena: AusenciaParaCobertura = {
      empleadoId: 'otro',
      tipo: 'IT_CONTINGENCIA_COMUN',
      periodo: junio,
    };

    const fila = construirFila('e1', 'Rosa Vega', semanas, [adscripcion], [ajena], etiqueta);
    expect(fila.celdas[0]?.estado).toBe('CUBIERTO');
  });

  it('dos ausencias solapadas no se llevan más de lo comprometido', () => {
    const solapadas: AusenciaParaCobertura[] = [
      {
        empleadoId: 'e1',
        tipo: 'IT_CONTINGENCIA_COMUN',
        periodo: { desde: f('2026-06-01'), hasta: f('2026-06-07') },
      },
      {
        empleadoId: 'e1',
        tipo: 'VACACIONES',
        periodo: { desde: f('2026-06-01'), hasta: f('2026-06-07') },
      },
    ];

    const fila = construirFila('e1', 'Rosa Vega', semanas, [adscripcion], solapadas, etiqueta);

    expect(fila.celdas[0]?.ausentes).toBe(40);
    expect(fila.celdas[0]?.disponibles).toBe(0);
  });

  it('cada estado tiene texto, no sólo color', () => {
    // El color solo no vale: lo audita cualquier comprador público.
    for (const texto of Object.values(ETIQUETAS_CELDA)) {
      expect(texto.length).toBeGreaterThan(0);
    }
  });
});

describe('proyectarCobertura', () => {
  it('aplica la tasa observada a lo planificado', () => {
    const proyeccion = proyectarCobertura(400, 40, 200);

    expect(proyeccion.tasaHistorica).toBe(0.1);
    expect(proyeccion.horasEnRiesgo).toBe(20);
    expect(proyeccion.fiable).toBe(true);
  });

  it('con poca historia no arriesga un número', () => {
    // Una tasa sacada de una semana suelta se citaría en una reunión como si
    // significase algo.
    const proyeccion = proyectarCobertura(HORAS_MINIMAS_PARA_PROYECTAR - 1, 40, 200);

    expect(proyeccion.fiable).toBe(false);
    expect(proyeccion.horasEnRiesgo).toBe(0);
  });

  it('sin historia no divide entre cero', () => {
    expect(proyectarCobertura(0, 0, 200).tasaHistorica).toBe(0);
  });
});
