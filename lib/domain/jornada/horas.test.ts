import { describe, expect, it } from 'vitest';

import {
  aHora,
  aMinutos,
  calcularHoras,
  esHoraDelDia,
  ETIQUETAS_BOLSA,
  evaluarBolsa,
  LIMITE_ANUAL_HORAS_EXTRA,
} from './horas';
import type { HoraDelDia, Jornada } from './horas';

const h = (valor: string) => valor as HoraDelDia;

function jornada(parcial: Partial<Jornada> = {}): Jornada {
  return {
    entrada: h('08:00'),
    salida: h('16:00'),
    pausas: [],
    horasOrdinariasPactadas: 8,
    esFestivo: false,
    ...parcial,
  };
}

describe('horas del día', () => {
  it('valida el formato de 24 horas', () => {
    expect(esHoraDelDia('08:00')).toBe(true);
    expect(esHoraDelDia('23:59')).toBe(true);
    expect(esHoraDelDia('24:00')).toBe(false);
    expect(esHoraDelDia('8:00')).toBe(false);
  });

  it('convierte en los dos sentidos', () => {
    expect(aMinutos(h('22:30'))).toBe(1350);
    expect(aHora(1350)).toBe('22:30');
  });
});

describe('calcularHoras', () => {
  it('una jornada normal son sus horas ordinarias', () => {
    const horas = calcularHoras(jornada());

    expect(horas.trabajadas).toBe(8);
    expect(horas.ordinarias).toBe(8);
    expect(horas.extra).toBe(0);
    expect(horas.nocturnas).toBe(0);
  });

  it('la pausa no se cuenta como trabajada', () => {
    const horas = calcularHoras(
      jornada({ pausas: [{ desde: h('12:00'), hasta: h('12:30') }] }),
    );

    expect(horas.minutosDePausa).toBe(30);
    expect(horas.trabajadas).toBe(7.5);
    // Y por debajo de lo pactado no hay horas extra ni negativas.
    expect(horas.extra).toBe(0);
  });

  it('lo que pasa de la jornada pactada es hora extra', () => {
    const horas = calcularHoras(jornada({ salida: h('18:30') }));

    expect(horas.trabajadas).toBe(10.5);
    expect(horas.ordinarias).toBe(8);
    expect(horas.extra).toBe(2.5);
  });

  it('respeta la jornada pactada del convenio, no una de 40 horas por defecto', () => {
    // Con 7 horas pactadas, ocho trabajadas son una extra. Dar por supuesto un
    // convenio de 40 horas escondería esa hora en quien tiene jornada menor.
    const horas = calcularHoras(jornada({ horasOrdinariasPactadas: 7 }));
    expect(horas.extra).toBe(1);
  });

  it('cuenta como nocturnas sólo las de 22:00 a 06:00 (art. 36.1 ET)', () => {
    const horas = calcularHoras(
      jornada({ entrada: h('20:00'), salida: h('02:00'), horasOrdinariasPactadas: 6 }),
    );

    expect(horas.trabajadas).toBe(6);
    // De 22:00 a 02:00: cuatro horas.
    expect(horas.nocturnas).toBe(4);
  });

  it('un turno que cruza la medianoche no sale negativo', () => {
    const horas = calcularHoras(
      jornada({ entrada: h('22:00'), salida: h('06:00'), horasOrdinariasPactadas: 8 }),
    );

    expect(horas.trabajadas).toBe(8);
    // La banda nocturna entera.
    expect(horas.nocturnas).toBe(8);
  });

  it('la pausa nocturna tampoco cuenta como nocturna trabajada', () => {
    const horas = calcularHoras(
      jornada({
        entrada: h('22:00'),
        salida: h('06:00'),
        pausas: [{ desde: h('02:00'), hasta: h('03:00') }],
        horasOrdinariasPactadas: 8,
      }),
    );

    expect(horas.trabajadas).toBe(7);
    expect(horas.nocturnas).toBe(7);
  });

  it('en festivo lo trabajado es festivo entero, no por tramos', () => {
    const horas = calcularHoras(jornada({ esFestivo: true }));

    expect(horas.festivas).toBe(8);
    expect(calcularHoras(jornada()).festivas).toBe(0);
  });
});

describe('evaluarBolsa', () => {
  it('el límite anual son 80 horas (art. 35.2 ET)', () => {
    expect(LIMITE_ANUAL_HORAS_EXTRA).toBe(80);
  });

  it('avisa al 70 %, antes de que sea tarde para hacer algo', () => {
    expect(evaluarBolsa(55).estado).toBe('HOLGADA');
    expect(evaluarBolsa(56).estado).toBe('CERCA_DEL_LIMITE');
    expect(evaluarBolsa(56).restantes).toBe(24);
  });

  it('en el límite y por encima exige justificación', () => {
    expect(evaluarBolsa(80).estado).toBe('EN_EL_LIMITE');
    expect(evaluarBolsa(80).requiereJustificacion).toBe(true);
    expect(evaluarBolsa(81).estado).toBe('EXCEDIDA');
    expect(evaluarBolsa(81).requiereJustificacion).toBe(true);
    // No quedan horas negativas: quedan cero.
    expect(evaluarBolsa(95).restantes).toBe(0);
  });

  it('cada estado tiene texto además de color', () => {
    for (const texto of Object.values(ETIQUETAS_BOLSA)) {
      expect(texto.length).toBeGreaterThan(0);
    }
  });
});
