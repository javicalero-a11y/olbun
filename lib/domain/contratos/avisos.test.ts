import { describe, expect, it } from 'vitest';

import type { FechaCivil } from '../fecha';
import { avisoMasUrgente, avisosDeContrato } from './avisos';

const f = (s: string): FechaCivil => s;
const HOY = f('2026-08-12');

const base = { estado: 'EN_EJECUCION' as const };

describe('avisosDeContrato', () => {
  it('no avisa sin fecha de fin', () => {
    expect(avisosDeContrato({ ...base }, HOY)).toEqual([]);
  });

  it('no avisa sobre contratos ya cerrados o aún en licitación', () => {
    for (const estado of ['FINALIZADO', 'RESUELTO', 'PERDIDO', 'LICITACION']) {
      expect(
        avisosDeContrato({ estado, fechaFinPrevista: f('2026-09-01') }, HOY),
        estado,
      ).toEqual([]);
    }
  });

  it('avisa del fin de contrato', () => {
    const avisos = avisosDeContrato({ ...base, fechaFinPrevista: f('2026-09-01') }, HOY);

    expect(avisos).toHaveLength(1);
    expect(avisos[0]?.diasRestantes).toBe(20);
    expect(avisos[0]?.nivel).toBe('CRITICO');
    expect(avisos[0]?.detalle).toContain('01/09/2026');
  });

  it('gradúa el nivel según lo que queda', () => {
    const nivel = (fin: string) =>
      avisosDeContrato({ ...base, fechaFinPrevista: f(fin) }, HOY)[0]?.nivel;

    expect(nivel('2026-09-01')).toBe('CRITICO'); // 20 días
    expect(nivel('2026-10-01')).toBe('ALTO'); // 50 días
    expect(nivel('2026-11-01')).toBe('MEDIO'); // 81 días
    expect(nivel('2027-06-01')).toBe('INFORMATIVO'); // muy lejos
  });

  it('el preaviso de prórroga se avisa antes que el fin', () => {
    const avisos = avisosDeContrato(
      { ...base, fechaFinPrevista: f('2026-12-31'), preavisoProrrogaDias: 90 },
      HOY,
    );

    expect(avisos).toHaveLength(2);
    // El preaviso (2 de octubre) va primero por ser más inminente.
    expect(avisos[0]?.titulo).toBe('Preaviso de prórroga');
    expect(avisos[0]?.fecha).toBe('2026-10-02');
    expect(avisos[1]?.titulo).toBe('Fin de contrato');
  });

  it('marca el preaviso vencido como crítico aunque el contrato siga vivo', () => {
    const avisos = avisosDeContrato(
      { ...base, fechaFinPrevista: f('2026-10-01'), preavisoProrrogaDias: 90 },
      HOY,
    );

    const preaviso = avisos.find(
      (a) => a.titulo.includes('preaviso') || a.titulo.includes('Preaviso'),
    );

    expect(preaviso?.nivel).toBe('CRITICO');
    expect(preaviso?.diasRestantes).toBeLessThan(0);
    expect(preaviso?.detalle).toContain('perdido');
  });

  it('detecta un contrato vencido que sigue marcado como activo', () => {
    const avisos = avisosDeContrato({ ...base, fechaFinPrevista: f('2026-07-01') }, HOY);

    expect(avisos[0]?.titulo).toBe('Contrato vencido');
    expect(avisos[0]?.diasRestantes).toBe(-42);
  });

  it('ignora un preaviso de cero o negativo', () => {
    const avisos = avisosDeContrato(
      { ...base, fechaFinPrevista: f('2026-12-31'), preavisoProrrogaDias: 0 },
      HOY,
    );

    expect(avisos).toHaveLength(1);
  });
});

describe('avisoMasUrgente', () => {
  it('devuelve el aviso más inminente', () => {
    const aviso = avisoMasUrgente(
      { ...base, fechaFinPrevista: f('2026-12-31'), preavisoProrrogaDias: 90 },
      HOY,
    );

    expect(aviso?.titulo).toBe('Preaviso de prórroga');
  });

  it('no devuelve nada si todo queda lejos', () => {
    expect(
      avisoMasUrgente({ ...base, fechaFinPrevista: f('2028-01-01') }, HOY),
    ).toBeUndefined();
  });
});
