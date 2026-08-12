import { describe, expect, it } from 'vitest';

import { planificarPasos, type PasoPlantilla } from './planificacion';
import type { CalendarioAplicable } from '@/lib/domain/plazos/calendario';

/** A verified 2026 with no holidays, so the arithmetic is easy to check by hand. */
const CALENDARIO: CalendarioAplicable = {
  nacional: { aniosCubiertos: [2026, 2027], festivos: [] },
  autonomico: { aniosCubiertos: [2026, 2027], festivos: [] },
  local: { aniosCubiertos: [2026, 2027], festivos: [] },
};

const APERTURA = '2026-03-02'; // lunes

/** The shape of the seeded "penalidad contractual" template. */
const PENALIDAD: PasoPlantilla[] = [
  { orden: 1, nombre: 'Recepción de la propuesta', desplazamientoDias: 0 },
  {
    orden: 2,
    nombre: 'Presentación de alegaciones',
    plazoCantidad: 10,
    plazoComputo: 'HABILES_ADMINISTRATIVO',
    plazoFundamento: 'art. 82.2 Ley 39/2015',
    plazoEsPreclusivo: true,
  },
  { orden: 3, nombre: 'Resolución del órgano', desplazamientoDias: 45 },
  {
    orden: 4,
    nombre: 'Recurso de reposición',
    plazoCantidad: 1,
    plazoComputo: 'MESES',
    plazoFundamento: 'art. 124.1 Ley 39/2015',
    plazoEsPreclusivo: true,
  },
];

describe('planificarPasos', () => {
  it('cuenta el primer plazo desde la apertura', () => {
    const plan = planificarPasos(PENALIDAD, APERTURA, CALENDARIO);
    expect(plan[1]?.inicio).toBe(APERTURA);
  });

  it('el plazo para recurrir no arranca de la apertura, sino de la resolución', () => {
    const plan = planificarPasos(PENALIDAD, APERTURA, CALENDARIO);

    const alegaciones = plan[1]!;
    const resolucion = plan[2]!;
    const recurso = plan[3]!;

    // Lo importante: el recurso no puede empezar a correr antes de que exista
    // la resolución que se recurre.
    expect(recurso.inicio).toBe(resolucion.fechaPrevista);
    expect(recurso.inicio > alegaciones.fechaPrevista!).toBe(true);
    expect(recurso.inicio).not.toBe(APERTURA);
  });

  it('encadena las fechas paso a paso', () => {
    const plan = planificarPasos(PENALIDAD, APERTURA, CALENDARIO);

    // 10 días hábiles desde el lunes 2 de marzo, sin festivos: vence el 16.
    expect(plan[1]?.fechaPrevista).toBe('2026-03-16');
    // Resolución estimada 45 días naturales después.
    expect(plan[2]?.fechaPrevista).toBe('2026-04-30');
    // Un mes desde la resolución sería el sábado 30 de mayo, que es inhábil:
    // se prorroga al lunes siguiente (art. 30.5 Ley 39/2015).
    expect(plan[3]?.fechaPrevista).toBe('2026-06-01');
  });

  it('un desplazamiento de cero días es el propio hecho, no una estimación', () => {
    const plan = planificarPasos(PENALIDAD, APERTURA, CALENDARIO);

    expect(plan[0]?.estimada).toBe(false);
    expect(plan[1]?.estimada).toBe(false);
    expect(plan[1]?.plazo?.completo).toBe(true);
  });

  it('todo lo que cuelga de una fecha estimada queda marcado como estimado', () => {
    const plan = planificarPasos(PENALIDAD, APERTURA, CALENDARIO);

    expect(plan[2]?.estimada).toBe(false); // es la estimación misma
    expect(plan[3]?.estimada).toBe(true); // cuelga de ella
  });

  it('un plazo apoyado en una estimación nunca se da por completo', () => {
    const plan = planificarPasos(PENALIDAD, APERTURA, CALENDARIO);
    const recurso = plan[3]!;

    expect(recurso.plazo?.completo).toBe(false);
    expect(recurso.plazo?.advertencias.some((a) => a.includes('fecha estimada'))).toBe(true);
  });

  it('conserva las advertencias del motor de cómputo además de la suya', () => {
    const sinCalendario: CalendarioAplicable = {
      nacional: { aniosCubiertos: [], festivos: [] },
    };

    const plan = planificarPasos(PENALIDAD, APERTURA, sinCalendario);

    expect(plan[1]?.plazo?.completo).toBe(false);
    expect(plan[1]?.plazo?.advertencias.length).toBeGreaterThan(0);
    expect(plan[3]?.plazo?.advertencias.length).toBeGreaterThan(
      plan[1]!.plazo!.advertencias.length,
    );
  });

  it('ordena por el orden del procedimiento aunque lleguen desordenados', () => {
    const plan = planificarPasos([...PENALIDAD].reverse(), APERTURA, CALENDARIO);
    expect(plan.map((p) => p.orden)).toEqual([1, 2, 3, 4]);
  });

  it('un paso sin plazo ni desplazamiento no rompe la cadena ni recibe fecha', () => {
    const plan = planificarPasos(
      [
        { orden: 1, nombre: 'Apertura', desplazamientoDias: 0 },
        { orden: 2, nombre: 'Trámite sin fecha' },
        { orden: 3, nombre: 'Escrito', plazoCantidad: 5, plazoComputo: 'NATURALES' },
      ],
      APERTURA,
      CALENDARIO,
    );

    expect(plan[1]?.fechaPrevista).toBeUndefined();
    expect(plan[2]?.inicio).toBe(APERTURA);
  });

  it('no devuelve nada para una plantilla vacía', () => {
    expect(planificarPasos([], APERTURA, CALENDARIO)).toEqual([]);
  });
});
