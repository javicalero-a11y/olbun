import { describe, expect, it } from 'vitest';

import {
  coberturaRealPorCategoria,
  diasLaborables,
  diasNaturales,
  estadoEn,
  horasPorDiasLaborables,
  indiceDeAbsentismo,
  interseccion,
  seSolapan,
  TIPOS_AUSENCIA,
} from './ausencias';
import type { AdscripcionParaCobertura, AusenciaParaCobertura, Periodo } from './ausencias';
import type { FechaCivil } from '../fecha';

const f = (valor: string) => valor as FechaCivil;

/** Lunes 2026-06-01 a domingo 2026-06-07: cinco laborables. */
const semana: Periodo = { desde: f('2026-06-01'), hasta: f('2026-06-07') };

describe('días', () => {
  it('cuenta los naturales con los dos extremos incluidos', () => {
    // Una baja que empieza y acaba el mismo día es un día, no cero.
    expect(diasNaturales({ desde: f('2026-06-01'), hasta: f('2026-06-01') })).toBe(1);
    expect(diasNaturales(semana)).toBe(7);
  });

  it('descuenta sábados, domingos y festivos', () => {
    expect(diasLaborables(semana)).toBe(5);
    expect(diasLaborables(semana, new Set(['2026-06-03']))).toBe(4);
  });

  it('un parte de viernes a lunes son cuatro naturales y dos laborables', () => {
    // Los dos números existen porque los piden dos sitios distintos: la
    // Seguridad Social cuenta naturales, un déficit de cobertura no.
    const parte: Periodo = { desde: f('2026-06-05'), hasta: f('2026-06-08') };
    expect(diasNaturales(parte)).toBe(4);
    expect(diasLaborables(parte)).toBe(2);
  });
});

describe('intersección', () => {
  it('devuelve el tramo común', () => {
    expect(interseccion(semana, { desde: f('2026-06-04'), hasta: f('2026-06-30') })).toEqual({
      desde: f('2026-06-04'),
      hasta: f('2026-06-07'),
    });
  });

  it('dos periodos que sólo se tocan un día se solapan ese día', () => {
    expect(seSolapan(semana, { desde: f('2026-06-07'), hasta: f('2026-06-10') })).toBe(true);
    expect(seSolapan(semana, { desde: f('2026-06-08'), hasta: f('2026-06-10') })).toBe(false);
  });
});

describe('estadoEn', () => {
  it('distingue prevista, activa y cerrada', () => {
    expect(estadoEn(semana, f('2026-05-31'))).toBe('PREVISTA');
    expect(estadoEn(semana, f('2026-06-01'))).toBe('ACTIVA');
    // El último día todavía cuenta: quien vuelve el lunes ha faltado el domingo.
    expect(estadoEn(semana, f('2026-06-07'))).toBe('ACTIVA');
    expect(estadoEn(semana, f('2026-06-08'))).toBe('CERRADA');
  });
});

describe('catálogo de tipos', () => {
  it('las vacaciones quitan disponibilidad pero no son absentismo', () => {
    // Un índice de absentismo que incluya las vacaciones dice que una empresa
    // que cumple falla cada agosto.
    expect(TIPOS_AUSENCIA.VACACIONES.computaAbsentismo).toBe(false);
    expect(TIPOS_AUSENCIA.VACACIONES.requiereSustitucionPorDefecto).toBe(true);
  });

  it('la huelga no propone sustituto', () => {
    // Sustituir a quien secunda una huelga es ilegal (art. 6.5 RDL 17/1977):
    // el producto no puede sugerirlo como si fuera un turno que cubrir.
    expect(TIPOS_AUSENCIA.HUELGA.requiereSustitucionPorDefecto).toBe(false);
    expect(TIPOS_AUSENCIA.HUELGA.computaAbsentismo).toBe(false);
  });

  it('el crédito sindical no cuenta como absentismo', () => {
    expect(TIPOS_AUSENCIA.CREDITO_HORARIO_SINDICAL.computaAbsentismo).toBe(false);
  });

  it('la IT y la ausencia injustificada sí computan', () => {
    expect(TIPOS_AUSENCIA.IT_CONTINGENCIA_COMUN.computaAbsentismo).toBe(true);
    expect(TIPOS_AUSENCIA.AUSENCIA_INJUSTIFICADA.computaAbsentismo).toBe(true);
  });
});

describe('horasPorDiasLaborables', () => {
  it('reparte la semana entre cinco días', () => {
    expect(horasPorDiasLaborables(40, 5)).toBe(40);
    expect(horasPorDiasLaborables(40, 1)).toBe(8);
    expect(horasPorDiasLaborables(20, 3)).toBe(12);
  });
});

describe('coberturaRealPorCategoria', () => {
  const mes: Periodo = { desde: f('2026-06-01'), hasta: f('2026-06-05') };

  const exigencias = [
    { categoriaId: 'cat', centroTrabajo: 'Centro Norte', horasSemanales: 40 },
  ];

  const adscripcion: AdscripcionParaCobertura = {
    empleadoId: 'e1',
    categoriaId: 'cat',
    centroTrabajo: 'Centro Norte',
    horasSemanales: 40,
    periodo: { desde: f('2026-01-01'), hasta: f('2026-12-31') },
  };

  it('sin ausencias, lo adscrito está disponible', () => {
    const [fila] = coberturaRealPorCategoria(mes, exigencias, [adscripcion], []);

    expect(fila?.exigidas).toBe(40);
    expect(fila?.disponibles).toBe(40);
    expect(fila?.deficit).toBe(0);
    expect(fila?.porcentaje).toBe(100);
  });

  it('una baja de dos días se lleva sus horas y abre un déficit', () => {
    const baja: AusenciaParaCobertura = {
      empleadoId: 'e1',
      tipo: 'IT_CONTINGENCIA_COMUN',
      periodo: { desde: f('2026-06-01'), hasta: f('2026-06-02') },
    };

    const [fila] = coberturaRealPorCategoria(mes, exigencias, [adscripcion], [baja]);

    expect(fila?.perdidasPorAusencia).toBe(16);
    expect(fila?.disponibles).toBe(24);
    expect(fila?.deficit).toBe(16);
    expect(fila?.porcentaje).toBe(60);
  });

  it('las vacaciones descuentan igual que una baja: el turno hay que cubrirlo', () => {
    const vacaciones: AusenciaParaCobertura = {
      empleadoId: 'e1',
      tipo: 'VACACIONES',
      periodo: { desde: f('2026-06-01'), hasta: f('2026-06-02') },
    };

    const [fila] = coberturaRealPorCategoria(mes, exigencias, [adscripcion], [vacaciones]);
    expect(fila?.disponibles).toBe(24);
  });

  it('dos ausencias el mismo día no restan dos veces', () => {
    // Solaparlas restaría 80 horas de 40 y dejaría la cobertura en negativo,
    // que es la clase de número que hace desconfiar de toda la pantalla.
    const ausencias: AusenciaParaCobertura[] = [
      {
        empleadoId: 'e1',
        tipo: 'IT_CONTINGENCIA_COMUN',
        periodo: { desde: f('2026-06-01'), hasta: f('2026-06-05') },
      },
      {
        empleadoId: 'e1',
        tipo: 'VACACIONES',
        periodo: { desde: f('2026-06-01'), hasta: f('2026-06-05') },
      },
    ];

    const [fila] = coberturaRealPorCategoria(mes, exigencias, [adscripcion], ausencias);

    expect(fila?.perdidasPorAusencia).toBe(40);
    expect(fila?.disponibles).toBe(0);
    expect(fila?.porcentaje).toBe(0);
  });

  it('la ausencia de otra persona no descuenta de esta adscripción', () => {
    const ajena: AusenciaParaCobertura = {
      empleadoId: 'otro',
      tipo: 'IT_CONTINGENCIA_COMUN',
      periodo: mes,
    };

    const [fila] = coberturaRealPorCategoria(mes, exigencias, [adscripcion], [ajena]);
    expect(fila?.disponibles).toBe(40);
  });

  it('una adscripción que empieza a mitad sólo promete su parte', () => {
    const aMitad: AdscripcionParaCobertura = {
      ...adscripcion,
      periodo: { desde: f('2026-06-04'), hasta: f('2026-12-31') },
    };

    const [fila] = coberturaRealPorCategoria(mes, exigencias, [aMitad], []);

    // Jueves y viernes: 16 horas de las 40 exigidas.
    expect(fila?.adscritas).toBe(16);
    expect(fila?.deficit).toBe(24);
  });

  it('un festivo no exige ni consume horas', () => {
    const festivos = new Set(['2026-06-01']);
    const [fila] = coberturaRealPorCategoria(mes, exigencias, [adscripcion], [], festivos);

    expect(fila?.exigidas).toBe(32);
    expect(fila?.disponibles).toBe(32);
  });

  it('no parte los centros cuyo nombre lleva espacios', () => {
    // La clave compuesta se separa con NUL: partirla por espacios convertía
    // «Centro Norte» en la categoría «Centro» del centro «Norte».
    const [fila] = coberturaRealPorCategoria(mes, exigencias, [adscripcion], []);
    expect(fila?.centroTrabajo).toBe('Centro Norte');
    expect(fila?.categoriaId).toBe('cat');
  });
});

describe('indiceDeAbsentismo', () => {
  const mes: Periodo = { desde: f('2026-06-01'), hasta: f('2026-06-05') };

  it('sólo cuenta lo que es absentismo', () => {
    const ausencias: AusenciaParaCobertura[] = [
      {
        empleadoId: 'e1',
        tipo: 'IT_CONTINGENCIA_COMUN',
        periodo: { desde: f('2026-06-01'), hasta: f('2026-06-01') },
      },
      { empleadoId: 'e2', tipo: 'VACACIONES', periodo: mes },
      { empleadoId: 'e3', tipo: 'CREDITO_HORARIO_SINDICAL', periodo: mes },
    ];

    const indice = indiceDeAbsentismo(mes, ausencias, 4);

    // Un día de IT sobre 5 laborables × 4 personas = 20 días teóricos.
    expect(indice.diasComputables).toBe(1);
    expect(indice.diasTeoricos).toBe(20);
    expect(indice.porcentaje).toBe(5);
    expect(indice.porTipo).toEqual([{ tipo: 'IT_CONTINGENCIA_COMUN', dias: 1 }]);
  });

  it('sin plantilla no inventa un porcentaje', () => {
    expect(indiceDeAbsentismo(mes, [], 0).porcentaje).toBe(0);
  });
});
