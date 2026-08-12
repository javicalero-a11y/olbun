import { describe, expect, it } from 'vitest';

import type { FechaCivil } from '../fecha';
import type { CalendarioAplicable } from './calendario';
import { calcularVencimiento, fechaEfectosNotificacion } from './computo';

const f = (s: string): FechaCivil => s;

/**
 * Fixtures use real 2026 dates. Fixed national holidays are certain; the ones
 * that move (Semana Santa) and every autonomous and local holiday are examples
 * chosen to exercise the rules, not an authoritative calendar. The seeded
 * calendars carry the real ones.
 */
const NACIONAL_2026 = [
  { fecha: f('2026-01-01'), nombre: 'Año Nuevo' },
  { fecha: f('2026-01-06'), nombre: 'Epifanía del Señor' },
  { fecha: f('2026-04-03'), nombre: 'Viernes Santo' },
  { fecha: f('2026-05-01'), nombre: 'Fiesta del Trabajo' },
  { fecha: f('2026-08-15'), nombre: 'Asunción de la Virgen' },
  { fecha: f('2026-10-12'), nombre: 'Fiesta Nacional de España' },
  { fecha: f('2026-11-02'), nombre: 'Todos los Santos (trasladado)' },
  { fecha: f('2026-12-08'), nombre: 'Inmaculada Concepción' },
  { fecha: f('2026-12-25'), nombre: 'Natividad del Señor' },
];

const calendario = (extra: Partial<CalendarioAplicable> = {}): CalendarioAplicable => ({
  nacional: { aniosCubiertos: [2025, 2026, 2027], festivos: NACIONAL_2026 },
  local: { aniosCubiertos: [2025, 2026, 2027], festivos: [] },
  ...extra,
});

const base = {
  calendario: calendario(),
  fundamento: 'prueba',
} as const;

describe('días hábiles administrativos (art. 30.2 Ley 39/2015)', () => {
  it('empieza a contar el día siguiente (art. 30.3)', () => {
    // Notificación el lunes 2 de marzo; el cómputo arranca el martes 3.
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-02'),
      cantidad: 1,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.inicioComputo).toBe('2026-03-03');
    expect(r.vencimiento).toBe('2026-03-03');
  });

  it('excluye sábados y domingos', () => {
    // Jueves 5 de marzo + 3 hábiles → viernes 6, lunes 9, martes 10.
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-05'),
      cantidad: 3,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.vencimiento).toBe('2026-03-10');
    expect(r.diasExcluidos.map((d) => d.motivo)).toEqual(['SABADO', 'DOMINGO']);
  });

  it('excluye los festivos nacionales', () => {
    // Jueves 30 de abril + 2 hábiles: el 1 de mayo es festivo, así que
    // cuentan el lunes 4 y el martes 5.
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-04-30'),
      cantidad: 2,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.vencimiento).toBe('2026-05-05');
    expect(r.diasExcluidos.some((d) => d.nombre === 'Fiesta del Trabajo')).toBe(true);
  });

  it('tiene en cuenta el festivo autonómico', () => {
    const conAutonomico = calendario({
      autonomico: {
        aniosCubiertos: [2026],
        festivos: [{ fecha: f('2026-02-28'), nombre: 'Día de Andalucía' }],
      },
    });

    // 28 de febrero de 2026 es sábado, así que se usa uno laborable para el
    // contraste: 2 de marzo (lunes) como festivo autonómico ficticio.
    const conLunes = calendario({
      autonomico: {
        aniosCubiertos: [2026],
        festivos: [{ fecha: f('2026-03-02'), nombre: 'Festivo autonómico' }],
      },
    });

    const sinFestivo = calcularVencimiento({
      ...base,
      calendario: conAutonomico,
      fechaInicio: f('2026-02-27'),
      cantidad: 1,
      computo: 'HABILES_ADMINISTRATIVO',
    });
    const conFestivo = calcularVencimiento({
      ...base,
      calendario: conLunes,
      fechaInicio: f('2026-02-27'),
      cantidad: 1,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(sinFestivo.vencimiento).toBe('2026-03-02');
    expect(conFestivo.vencimiento).toBe('2026-03-03');
  });

  it('tiene en cuenta el festivo local', () => {
    const conLocal = calendario({
      local: {
        aniosCubiertos: [2026],
        festivos: [{ fecha: f('2026-03-04'), nombre: 'Feria local' }],
      },
    });

    const r = calcularVencimiento({
      ...base,
      calendario: conLocal,
      fechaInicio: f('2026-03-02'),
      cantidad: 3,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    // Martes 3, (miércoles 4 festivo local), jueves 5, viernes 6.
    expect(r.vencimiento).toBe('2026-03-06');
    expect(r.diasExcluidos.some((d) => d.motivo === 'FESTIVO_LOCAL')).toBe(true);
  });

  it('agosto es hábil en vía administrativa', () => {
    // Del 3 al 7 de agosto de 2026 son lunes a viernes.
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-08-02'),
      cantidad: 5,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.vencimiento).toBe('2026-08-07');
    expect(r.diasExcluidos).toHaveLength(0);
  });

  it('prorroga al siguiente hábil si el vencimiento cae inhábil (art. 30.5)', () => {
    // 15 de agosto de 2026 es sábado *y* festivo nacional.
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-08-13'),
      cantidad: 1,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.vencimiento).toBe('2026-08-14');
    expect(r.prorrogadoPorInhabil).toBe(false);
  });

  it('un plazo de un día tras un viernes vence el lunes', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-06'), // viernes
      cantidad: 1,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.vencimiento).toBe('2026-03-09'); // lunes
  });

  it('el plazo típico de quince días hábiles cruza dos fines de semana', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-02'),
      cantidad: 15,
      computo: 'HABILES_ADMINISTRATIVO',
      fundamento: 'art. 44.2 LCSP — 15 días hábiles',
    });

    expect(r.vencimiento).toBe('2026-03-23');
    expect(r.fundamento).toContain('LCSP');
  });
});

describe('días naturales', () => {
  it('cuenta todos los días, festivos incluidos', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-04-29'),
      cantidad: 5,
      computo: 'NATURALES',
    });

    // 30 abril, 1, 2, 3 y 4 de mayo — el 1 de mayo cuenta.
    expect(r.vencimiento).toBe('2026-05-04');
    expect(r.diasExcluidos).toHaveLength(0);
  });

  it('no prorroga aunque acabe en domingo', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-09'),
      cantidad: 6,
      computo: 'NATURALES',
    });

    expect(r.vencimiento).toBe('2026-03-15'); // domingo
    expect(r.prorrogadoPorInhabil).toBe(false);
  });
});

describe('días hábiles judiciales (art. 182 LOPJ)', () => {
  it('agosto es inhábil', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-07-30'),
      cantidad: 2,
      computo: 'HABILES_JUDICIAL',
    });

    // Viernes 31 de julio cuenta; agosto entero se salta; el segundo día
    // hábil es el 1 de septiembre (martes).
    expect(r.vencimiento).toBe('2026-09-01');
    expect(r.diasExcluidos.some((d) => d.motivo === 'AGOSTO_INHABIL')).toBe(true);
  });

  it('agosto cuenta si el asunto es urgente', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-07-30'),
      cantidad: 2,
      computo: 'HABILES_JUDICIAL',
      agostoHabil: true,
    });

    expect(r.vencimiento).toBe('2026-08-03'); // viernes 31 y lunes 3
    expect(r.diasExcluidos.some((d) => d.motivo === 'AGOSTO_INHABIL')).toBe(false);
  });

  it('el 24 y el 31 de diciembre son inhábiles', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-12-22'),
      cantidad: 2,
      computo: 'HABILES_JUDICIAL',
    });

    // Miércoles 23 cuenta; el 24 es inhábil procesal; el 25 es festivo;
    // 26 y 27 fin de semana; el segundo hábil es el lunes 28.
    expect(r.vencimiento).toBe('2026-12-28');
    expect(r.diasExcluidos.some((d) => d.motivo === 'INHABIL_JUDICIAL')).toBe(true);
  });

  it('difiere del cómputo administrativo en agosto', () => {
    const parametros = {
      ...base,
      fechaInicio: f('2026-08-03'),
      cantidad: 5,
    } as const;

    const administrativo = calcularVencimiento({
      ...parametros,
      computo: 'HABILES_ADMINISTRATIVO',
    });
    const judicial = calcularVencimiento({ ...parametros, computo: 'HABILES_JUDICIAL' });

    expect(administrativo.vencimiento).not.toBe(judicial.vencimiento);
    expect(administrativo.vencimiento).toBe('2026-08-10');
    // Agosto entero se salta: martes 1, miércoles 2, jueves 3 y viernes 4 de
    // septiembre son los cuatro primeros hábiles; el quinto es el lunes 7.
    expect(judicial.vencimiento).toBe('2026-09-07');
  });
});

describe('plazos por meses y años (art. 30.4)', () => {
  it('vence de fecha a fecha, no al día siguiente', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-16'), // lunes
      cantidad: 1,
      computo: 'MESES',
    });

    expect(r.vencimiento).toBe('2026-04-16');
  });

  it('si no existe el día equivalente, vence el último del mes', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-01-30'),
      cantidad: 1,
      computo: 'MESES',
    });

    // 30 de febrero no existe → 28 de febrero, que en 2026 es sábado, así
    // que se prorroga al lunes 2 de marzo.
    expect(r.vencimiento).toBe('2026-03-02');
    expect(r.prorrogadoPorInhabil).toBe(true);
  });

  it('prorroga cuando el vencimiento cae en festivo', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-11-12'),
      cantidad: 1,
      computo: 'MESES',
    });

    // 12 de diciembre de 2026 es sábado → lunes 14.
    expect(r.vencimiento).toBe('2026-12-14');
    expect(r.prorrogadoPorInhabil).toBe(true);
  });

  it('cuenta los años de fecha a fecha', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-06-10'),
      cantidad: 1,
      computo: 'ANOS',
    });

    expect(r.vencimiento).toBe('2027-06-10');
  });

  it('los meses no descuentan festivos intermedios', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-04-15'),
      cantidad: 1,
      computo: 'MESES',
    });

    // El 1 de mayo cae dentro y no alarga el plazo.
    expect(r.vencimiento).toBe('2026-05-15');
    expect(r.diasExcluidos).toHaveLength(0);
  });
});

describe('trazabilidad y validación', () => {
  it('devuelve el desglose de días excluidos para poder auditarlo', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-05'),
      cantidad: 3,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.diasExcluidos).toEqual([
      { fecha: '2026-03-07', motivo: 'SABADO' },
      { fecha: '2026-03-08', motivo: 'DOMINGO' },
    ]);
  });

  it('marca el resultado incompleto si falta el calendario de un año', () => {
    const sinCobertura = calendario({
      nacional: { aniosCubiertos: [2025], festivos: NACIONAL_2026 },
    });

    const r = calcularVencimiento({
      ...base,
      calendario: sinCobertura,
      fechaInicio: f('2026-03-02'),
      cantidad: 5,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.completo).toBe(false);
    expect(r.advertencias.join(' ')).toContain('2026');
  });

  it('avisa cuando no se ha indicado calendario local', () => {
    const r = calcularVencimiento({
      ...base,
      calendario: { nacional: { aniosCubiertos: [2026], festivos: NACIONAL_2026 } },
      fechaInicio: f('2026-03-02'),
      cantidad: 3,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.completo).toBe(false);
    expect(r.advertencias.join(' ')).toContain('local');
  });

  it('es completo cuando todos los ámbitos están cubiertos', () => {
    const r = calcularVencimiento({
      ...base,
      fechaInicio: f('2026-03-02'),
      cantidad: 3,
      computo: 'HABILES_ADMINISTRATIVO',
    });

    expect(r.completo).toBe(true);
    expect(r.advertencias).toHaveLength(0);
  });

  it('rechaza cantidades no válidas', () => {
    for (const cantidad of [0, -1, 1.5, Number.NaN]) {
      expect(
        () =>
          calcularVencimiento({
            ...base,
            fechaInicio: f('2026-03-02'),
            cantidad,
            computo: 'HABILES_ADMINISTRATIVO',
          }),
        String(cantidad),
      ).toThrow(/entero positivo/);
    }
  });

  it('aborta en lugar de colgarse ante un calendario patológico', () => {
    // Un calendario que declara inhábiles más días de los que el motor está
    // dispuesto a recorrer. Sin la guarda, esto sería un bucle infinito en
    // producción; con ella, un error explícito que alguien puede diagnosticar.
    const todoFestivo = {
      nacional: {
        aniosCubiertos: Array.from({ length: 15 }, (_, i) => 2026 + i),
        festivos: Array.from({ length: 4200 }, (_, i) => {
          const d = new Date(Date.UTC(2026, 0, 1 + i));
          return {
            fecha: f(d.toISOString().slice(0, 10)),
            nombre: 'Festivo de prueba',
          };
        }),
      },
      local: { aniosCubiertos: Array.from({ length: 15 }, (_, i) => 2026 + i), festivos: [] },
    };

    expect(() =>
      calcularVencimiento({
        ...base,
        calendario: todoFestivo,
        fechaInicio: f('2026-03-02'),
        cantidad: 5,
        computo: 'HABILES_ADMINISTRATIVO',
      }),
    ).toThrow(/no converge|prorrogar/);
  });
});

describe('fechaEfectosNotificacion (art. 43.2 Ley 39/2015)', () => {
  it('usa la fecha de acceso cuando se accede dentro de plazo', () => {
    const r = fechaEfectosNotificacion({
      puestaADisposicion: f('2026-03-02'),
      fechaAcceso: f('2026-03-05'),
    });

    expect(r.fecha).toBe('2026-03-05');
    expect(r.porRechazoTacito).toBe(false);
  });

  it('aplica rechazo tácito a los diez días naturales sin acceder', () => {
    const r = fechaEfectosNotificacion({ puestaADisposicion: f('2026-03-02') });

    expect(r.fecha).toBe('2026-03-12');
    expect(r.porRechazoTacito).toBe(true);
    expect(r.fundamento).toContain('43.2');
  });

  it('el décimo día aún cuenta como acceso en plazo', () => {
    const r = fechaEfectosNotificacion({
      puestaADisposicion: f('2026-03-02'),
      fechaAcceso: f('2026-03-12'),
    });

    expect(r.porRechazoTacito).toBe(false);
  });

  it('un acceso posterior al rechazo tácito no lo revive', () => {
    const r = fechaEfectosNotificacion({
      puestaADisposicion: f('2026-03-02'),
      fechaAcceso: f('2026-03-20'),
    });

    expect(r.fecha).toBe('2026-03-12');
    expect(r.porRechazoTacito).toBe(true);
  });

  it('los diez días son naturales: incluyen fines de semana', () => {
    // Del 2 al 12 de marzo hay dos fines de semana; no alargan el plazo.
    const r = fechaEfectosNotificacion({ puestaADisposicion: f('2026-03-02') });
    expect(r.fecha).toBe('2026-03-12');
  });
});

describe('caso completo: recurso especial en materia de contratación', () => {
  it('quince días hábiles desde el rechazo tácito de la notificación', () => {
    const efectos = fechaEfectosNotificacion({
      puestaADisposicion: f('2026-04-20'),
    });

    const plazo = calcularVencimiento({
      ...base,
      fechaInicio: efectos.fecha,
      cantidad: 15,
      computo: 'HABILES_ADMINISTRATIVO',
      fundamento: 'art. 50.1 LCSP — 15 días hábiles',
    });

    expect(efectos.fecha).toBe('2026-04-30');
    expect(efectos.porRechazoTacito).toBe(true);
    // 1 de mayo festivo, más tres fines de semana.
    expect(plazo.vencimiento).toBe('2026-05-22');
    expect(plazo.completo).toBe(true);
  });
});
