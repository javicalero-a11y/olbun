import { describe, expect, it } from 'vitest';

import {
  analizar,
  comparar,
  componer,
  diaSemana,
  diasEnMes,
  diferenciaEnDias,
  esAnterior,
  esBisiesto,
  esFechaCivil,
  esSabadoODomingo,
  formatearEs,
  hoyEn,
  sumarAnios,
  sumarDias,
  sumarMeses,
  type FechaCivil,
} from './fecha';

const f = (s: string): FechaCivil => s;

describe('esFechaCivil', () => {
  it('acepta fechas bien formadas', () => {
    expect(esFechaCivil('2026-08-11')).toBe(true);
    expect(esFechaCivil('2024-02-29')).toBe(true); // bisiesto
  });

  it('rechaza formatos incorrectos', () => {
    for (const malo of ['11-08-2026', '2026/08/11', '2026-8-11', '', '2026-08', 'ayer']) {
      expect(esFechaCivil(malo), malo).toBe(false);
    }
  });

  it('rechaza fechas imposibles', () => {
    expect(esFechaCivil('2026-02-30')).toBe(false);
    expect(esFechaCivil('2025-02-29')).toBe(false); // no bisiesto
    expect(esFechaCivil('2026-13-01')).toBe(false);
    expect(esFechaCivil('2026-00-10')).toBe(false);
    expect(esFechaCivil('2026-04-31')).toBe(false);
  });
});

describe('analizar y componer', () => {
  it('van y vuelven sin pérdida', () => {
    const original = f('2026-03-07');
    expect(componer(analizar(original))).toBe(original);
  });

  it('lanza ante una fecha no válida', () => {
    expect(() => analizar('2026-02-30')).toThrow(/no válida/);
  });

  it('rellena con ceros', () => {
    expect(componer({ anio: 2026, mes: 1, dia: 5 })).toBe('2026-01-05');
  });
});

describe('esBisiesto', () => {
  it('aplica la regla completa, no sólo el múltiplo de cuatro', () => {
    expect(esBisiesto(2024)).toBe(true);
    expect(esBisiesto(2025)).toBe(false);
    expect(esBisiesto(1900)).toBe(false); // divisible por 100, no por 400
    expect(esBisiesto(2000)).toBe(true); // divisible por 400
  });
});

describe('diasEnMes', () => {
  it('devuelve la longitud correcta', () => {
    expect(diasEnMes(2026, 1)).toBe(31);
    expect(diasEnMes(2026, 2)).toBe(28);
    expect(diasEnMes(2024, 2)).toBe(29);
    expect(diasEnMes(2026, 4)).toBe(30);
    expect(diasEnMes(2026, 12)).toBe(31);
  });
});

describe('sumarDias', () => {
  it('suma dentro del mes', () => {
    expect(sumarDias(f('2026-03-10'), 5)).toBe('2026-03-15');
  });

  it('cruza el fin de mes', () => {
    expect(sumarDias(f('2026-01-30'), 3)).toBe('2026-02-02');
  });

  it('cruza el fin de año', () => {
    expect(sumarDias(f('2026-12-30'), 3)).toBe('2027-01-02');
  });

  it('resta con números negativos', () => {
    expect(sumarDias(f('2026-03-01'), -1)).toBe('2026-02-28');
    expect(sumarDias(f('2024-03-01'), -1)).toBe('2024-02-29');
  });

  it('sumar cero no cambia nada', () => {
    expect(sumarDias(f('2026-06-15'), 0)).toBe('2026-06-15');
  });

  it('no se desvía al cruzar el cambio de hora', () => {
    // Último domingo de marzo de 2026: España adelanta el reloj. Con Date
    // local esto puede saltar o repetir un día; en UTC no.
    expect(sumarDias(f('2026-03-28'), 1)).toBe('2026-03-29');
    expect(sumarDias(f('2026-03-29'), 1)).toBe('2026-03-30');
    // Último domingo de octubre: se atrasa.
    expect(sumarDias(f('2026-10-24'), 1)).toBe('2026-10-25');
    expect(sumarDias(f('2026-10-25'), 1)).toBe('2026-10-26');
  });

  it('mantiene la coherencia a lo largo de un año completo', () => {
    let fecha = f('2026-01-01');
    for (let i = 0; i < 365; i += 1) fecha = sumarDias(fecha, 1);
    expect(fecha).toBe('2027-01-01');
  });
});

describe('diferenciaEnDias', () => {
  it('cuenta los días entre dos fechas', () => {
    expect(diferenciaEnDias(f('2026-03-01'), f('2026-03-15'))).toBe(14);
    expect(diferenciaEnDias(f('2026-03-15'), f('2026-03-01'))).toBe(-14);
    expect(diferenciaEnDias(f('2026-03-01'), f('2026-03-01'))).toBe(0);
  });

  it('cuenta bien sobre un año bisiesto', () => {
    expect(diferenciaEnDias(f('2024-02-28'), f('2024-03-01'))).toBe(2);
    expect(diferenciaEnDias(f('2025-02-28'), f('2025-03-01'))).toBe(1);
  });
});

describe('comparar y esAnterior', () => {
  it('ordena cronológicamente', () => {
    expect(comparar(f('2026-01-01'), f('2026-01-02'))).toBeLessThan(0);
    expect(comparar(f('2026-01-02'), f('2026-01-01'))).toBeGreaterThan(0);
    expect(comparar(f('2026-01-01'), f('2026-01-01'))).toBe(0);
  });

  it('esAnterior es estricto', () => {
    expect(esAnterior(f('2026-01-01'), f('2026-01-02'))).toBe(true);
    expect(esAnterior(f('2026-01-01'), f('2026-01-01'))).toBe(false);
  });
});

describe('diaSemana', () => {
  it('usa la convención ISO: 1 lunes … 7 domingo', () => {
    expect(diaSemana(f('2026-08-10'))).toBe(1); // lunes
    expect(diaSemana(f('2026-08-14'))).toBe(5); // viernes
    expect(diaSemana(f('2026-08-15'))).toBe(6); // sábado
    expect(diaSemana(f('2026-08-16'))).toBe(7); // domingo
  });
});

describe('esSabadoODomingo', () => {
  it('reconoce el fin de semana', () => {
    expect(esSabadoODomingo(f('2026-08-15'))).toBe(true);
    expect(esSabadoODomingo(f('2026-08-16'))).toBe(true);
    expect(esSabadoODomingo(f('2026-08-14'))).toBe(false);
    expect(esSabadoODomingo(f('2026-08-17'))).toBe(false);
  });
});

describe('sumarMeses — de fecha a fecha (art. 30.4 Ley 39/2015)', () => {
  it('mantiene el mismo día del mes', () => {
    expect(sumarMeses(f('2026-03-15'), 1)).toBe('2026-04-15');
    expect(sumarMeses(f('2026-01-10'), 3)).toBe('2026-04-10');
  });

  it('si no existe el día equivalente, vence el último del mes', () => {
    expect(sumarMeses(f('2026-01-31'), 1)).toBe('2026-02-28');
    expect(sumarMeses(f('2024-01-31'), 1)).toBe('2024-02-29'); // bisiesto
    expect(sumarMeses(f('2026-03-31'), 1)).toBe('2026-04-30');
    expect(sumarMeses(f('2026-08-31'), 6)).toBe('2027-02-28');
  });

  it('cruza el fin de año', () => {
    expect(sumarMeses(f('2026-11-15'), 3)).toBe('2027-02-15');
    expect(sumarMeses(f('2026-12-31'), 1)).toBe('2027-01-31');
  });

  it('acepta meses negativos', () => {
    expect(sumarMeses(f('2026-03-31'), -1)).toBe('2026-02-28');
    expect(sumarMeses(f('2026-01-15'), -1)).toBe('2025-12-15');
  });

  it('sumar doce meses equivale a un año', () => {
    expect(sumarMeses(f('2026-05-20'), 12)).toBe(sumarAnios(f('2026-05-20'), 1));
  });

  it('el 29 de febrero de un bisiesto cae al 28 al sumar un año', () => {
    expect(sumarAnios(f('2024-02-29'), 1)).toBe('2025-02-28');
  });
});

describe('hoyEn', () => {
  it('devuelve el día según la zona horaria indicada', () => {
    // 23:30 UTC del 10 de agosto es ya el 11 en Madrid (CEST, UTC+2).
    const instante = new Date('2026-08-10T23:30:00.000Z');

    expect(hoyEn('Europe/Madrid', instante)).toBe('2026-08-11');
    expect(hoyEn('UTC', instante)).toBe('2026-08-10');
  });

  it('respeta Canarias, una hora por detrás de la Península', () => {
    const instante = new Date('2026-08-10T23:30:00.000Z');

    expect(hoyEn('Atlantic/Canary', instante)).toBe('2026-08-11');
    expect(hoyEn('Europe/Madrid', instante)).toBe('2026-08-11');

    // A las 00:30 UTC ya es día 11 en Madrid pero aún el 10 en Canarias.
    const otro = new Date('2026-08-10T00:30:00.000Z');
    expect(hoyEn('Europe/Madrid', otro)).toBe('2026-08-10');
    expect(hoyEn('Atlantic/Canary', otro)).toBe('2026-08-10');
  });
});

describe('formatearEs', () => {
  it('usa dd/MM/yyyy', () => {
    expect(formatearEs(f('2026-08-11'))).toBe('11/08/2026');
    expect(formatearEs(f('2026-01-05'))).toBe('05/01/2026');
  });
});
