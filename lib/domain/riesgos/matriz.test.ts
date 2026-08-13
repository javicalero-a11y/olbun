import { describe, expect, it } from 'vitest';

import {
  celdas,
  esEscala,
  nivelDe,
  nivelVigente,
  puntuacion,
  reduccion,
  valorar,
  valorarResidual,
} from './matriz';
import type { Escala } from './matriz';

describe('esEscala', () => {
  it('acepta del 1 al 5 y nada más', () => {
    for (const valor of [1, 2, 3, 4, 5]) expect(esEscala(valor)).toBe(true);
    for (const valor of [0, 6, -1, 2.5, Number.NaN]) expect(esEscala(valor)).toBe(false);
  });
});

describe('nivelDe', () => {
  it('coloca las esquinas de la matriz donde se espera', () => {
    expect(nivelDe(1, 1)).toBe('BAJO');
    expect(nivelDe(5, 5)).toBe('MUY_ALTO');
    // Las dos esquinas «uno alto, otro bajo» valen 5 y caen en medio.
    expect(nivelDe(1, 5)).toBe('MEDIO');
    expect(nivelDe(5, 1)).toBe('MEDIO');
  });

  it('respeta las fronteras de las bandas', () => {
    expect(puntuacion(2, 2)).toBe(4);
    expect(nivelDe(2, 2)).toBe('BAJO');
    expect(nivelDe(1, 5)).toBe('MEDIO'); // 5, primer punto de la banda
    expect(nivelDe(3, 3)).toBe('MEDIO'); // 9, último
    expect(nivelDe(2, 5)).toBe('ALTO'); // 10
    expect(nivelDe(4, 4)).toBe('MUY_ALTO'); // 16
  });

  it('la banda sale del producto, no de un solo eje', () => {
    // Un impacto crítico pero muy improbable puntúa 5 y queda en medio. Es
    // deliberado: la banda mide el producto, y encontrar las catástrofes
    // raras es cosa de filtrar por impacto, no de doblar la escala.
    expect(nivelDe(1, 5)).toBe('MEDIO');
    expect(nivelDe(3, 5)).toBe('MUY_ALTO');
  });

  it('es simétrica: da igual qué eje sea cuál', () => {
    for (let p = 1; p <= 5; p += 1) {
      for (let i = 1; i <= 5; i += 1) {
        expect(nivelDe(p as Escala, i as Escala)).toBe(nivelDe(i as Escala, p as Escala));
      }
    }
  });

  it('nunca baja de nivel al subir una puntuación', () => {
    const orden = { BAJO: 0, MEDIO: 1, ALTO: 2, MUY_ALTO: 3 };
    const todas = celdas().sort(
      (a, b) => a.probabilidad * a.impacto - b.probabilidad * b.impacto,
    );

    for (let i = 1; i < todas.length; i += 1) {
      expect(orden[todas[i]!.nivel]).toBeGreaterThanOrEqual(orden[todas[i - 1]!.nivel]);
    }
  });
});

describe('valorarResidual', () => {
  it('devuelve nulo cuando nadie lo ha valorado', () => {
    // «Sin valorar» y «los controles no han cambiado nada» son cosas
    // distintas, y confundirlas es como un registro acaba afirmando que todo
    // está tratado.
    expect(valorarResidual(null, null)).toBeNull();
    expect(valorarResidual(3, null)).toBeNull();
    expect(valorarResidual(undefined, 4)).toBeNull();
  });

  it('rechaza lo que se sale de la escala', () => {
    expect(valorarResidual(0, 3)).toBeNull();
    expect(valorarResidual(3, 9)).toBeNull();
  });

  it('valora cuando están los dos', () => {
    expect(valorarResidual(2, 2)).toEqual({
      probabilidad: 2,
      impacto: 2,
      puntuacion: 4,
      nivel: 'BAJO',
    });
  });
});

describe('reduccion', () => {
  const inherente = valorar(4, 4); // 16

  it('mide lo que compraron los controles', () => {
    expect(reduccion(inherente, valorar(2, 2))).toBeCloseTo(0.75, 4);
  });

  it('es nula sin residual valorado', () => {
    expect(reduccion(inherente, null)).toBeNull();
  });

  it('es cero cuando los controles no cambian nada', () => {
    expect(reduccion(inherente, valorar(4, 4))).toBe(0);
  });

  it('sale negativa si el residual es peor, en vez de disimularlo', () => {
    // Casi siempre significa que alguien puntuó mal, y verlo es justo lo útil.
    expect(reduccion(valorar(2, 2), valorar(4, 4))).toBeLessThan(0);
  });
});

describe('nivelVigente', () => {
  it('manda el residual cuando existe', () => {
    expect(nivelVigente(valorar(5, 5), valorar(1, 1)).nivel).toBe('BAJO');
  });

  it('sin residual, el riesgo pesa lo que pesaba', () => {
    // Nadie ha demostrado todavía que sea menor de lo que parece.
    expect(nivelVigente(valorar(5, 5), null).nivel).toBe('MUY_ALTO');
  });
});

describe('celdas', () => {
  it('describe la matriz entera', () => {
    expect(celdas()).toHaveLength(25);
  });

  it('reparte los niveles sin dejar ninguno vacío', () => {
    const niveles = new Set(celdas().map((celda) => celda.nivel));
    expect(niveles).toEqual(new Set(['BAJO', 'MEDIO', 'ALTO', 'MUY_ALTO']));
  });
});
