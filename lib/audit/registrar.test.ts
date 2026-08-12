import { describe, expect, it } from 'vitest';

import { redactar, soloCambios } from './registrar';

describe('redactar', () => {
  it('sustituye los campos secretos por un marcador', () => {
    const salida = redactar({
      email: 'ana@ejemplo.es',
      passwordHash: '$argon2id$v=19$...',
      mfaSecret: 'JBSWY3DPEHPK3PXP',
    }) as Record<string, unknown>;

    expect(salida['email']).toBe('ana@ejemplo.es');
    expect(salida['passwordHash']).toBe('[REDACTADO]');
    expect(salida['mfaSecret']).toBe('[REDACTADO]');
  });

  it('baja por objetos anidados', () => {
    const salida = redactar({
      usuario: { nombre: 'Ana', passwordHash: 'x' },
    }) as { usuario: Record<string, unknown> };

    expect(salida.usuario['nombre']).toBe('Ana');
    expect(salida.usuario['passwordHash']).toBe('[REDACTADO]');
  });

  it('recorre también los arrays', () => {
    const salida = redactar([{ token: 'abc' }, { token: 'def' }]) as Record<string, unknown>[];
    expect(salida[0]?.['token']).toBe('[REDACTADO]');
    expect(salida[1]?.['token']).toBe('[REDACTADO]');
  });

  it('redacta los códigos de recuperación, que son una lista de secretos', () => {
    const salida = redactar({ mfaRecoveryCodes: ['aaa', 'bbb'] }) as Record<string, unknown>;
    expect(salida['mfaRecoveryCodes']).toBe('[REDACTADO]');
  });

  it('convierte las fechas a texto para que el JSON sea estable', () => {
    const salida = redactar({ createdAt: new Date('2026-03-02T00:00:00.000Z') }) as Record<
      string,
      unknown
    >;
    expect(salida['createdAt']).toBe('2026-03-02T00:00:00.000Z');
  });

  it('deja en paz los valores simples', () => {
    expect(redactar('hola')).toBe('hola');
    expect(redactar(42)).toBe(42);
    expect(redactar(null)).toBe(null);
  });
});

describe('soloCambios', () => {
  it('guarda únicamente los campos que se movieron', () => {
    const { antes, despues } = soloCambios(
      { estado: 'ABIERTO', titulo: 'Penalidad', cuantia: 100 },
      { estado: 'RESUELTO', titulo: 'Penalidad', cuantia: 100 },
    );

    expect(antes).toEqual({ estado: 'ABIERTO' });
    expect(despues).toEqual({ estado: 'RESUELTO' });
  });

  it('no inventa un diff cuando sólo hay un lado', () => {
    expect(soloCambios(undefined, { titulo: 'Nuevo' })).toEqual({
      despues: { titulo: 'Nuevo' },
    });
    expect(soloCambios({ titulo: 'Viejo' }, undefined)).toEqual({
      antes: { titulo: 'Viejo' },
    });
  });

  it('detecta un campo que aparece o desaparece', () => {
    const { antes, despues } = soloCambios({ a: 1 }, { a: 1, b: 2 });
    expect(antes).toEqual({ b: undefined });
    expect(despues).toEqual({ b: 2 });
  });

  it('compara en profundidad, no por referencia', () => {
    const { despues } = soloCambios({ etiquetas: ['a', 'b'] }, { etiquetas: ['a', 'b'] });
    expect(despues).toEqual({});
  });

  it('sin cambios, no hay nada que registrar', () => {
    const { antes, despues } = soloCambios({ estado: 'ABIERTO' }, { estado: 'ABIERTO' });
    expect(antes).toEqual({});
    expect(despues).toEqual({});
  });
});
