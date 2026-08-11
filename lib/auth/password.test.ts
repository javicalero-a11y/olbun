import { describe, expect, it } from 'vitest';

import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from './password';

describe('hashPassword', () => {
  it('usa argon2id', async () => {
    // Guards the omitted `algorithm` option: if the library ever changes its
    // default away from argon2id, this fails instead of silently weakening
    // every password we store.
    const hash = await hashPassword('una-contraseña-larga-y-única');

    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('aplica los parámetros de coste esperados', async () => {
    const hash = await hashPassword('una-contraseña-larga-y-única');

    // $argon2id$v=19$m=65536,t=3,p=4$...
    expect(hash).toContain('m=65536');
    expect(hash).toContain('t=3');
    expect(hash).toContain('p=4');
  });

  it('produce un hash distinto cada vez (sal aleatoria)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('misma-contraseña-1234'),
      hashPassword('misma-contraseña-1234'),
    ]);

    expect(a).not.toBe(b);
  });

  it('nunca contiene la contraseña en claro', async () => {
    const password = 'zanahoria-melancolica-42';
    const hash = await hashPassword(password);

    expect(hash).not.toContain(password);
  });
});

describe('verifyPassword', () => {
  it('acepta la contraseña correcta', async () => {
    const password = 'contraseña-correcta-123';
    const hash = await hashPassword(password);

    expect(await verifyPassword(hash, password)).toBe(true);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('contraseña-correcta-123');

    expect(await verifyPassword(hash, 'contraseña-incorrecta-123')).toBe(false);
  });

  it('distingue mayúsculas y minúsculas', async () => {
    const hash = await hashPassword('Contraseña-Correcta-123');

    expect(await verifyPassword(hash, 'contraseña-correcta-123')).toBe(false);
  });

  it('devuelve false ante un hash corrupto en lugar de lanzar', async () => {
    expect(await verifyPassword('esto-no-es-un-hash', 'lo-que-sea-1234')).toBe(false);
    expect(await verifyPassword('', 'lo-que-sea-1234')).toBe(false);
  });

  it('maneja contraseñas con acentos y emoji', async () => {
    const password = 'contraseña-ñoña-🔐-válida';
    const hash = await hashPassword(password);

    expect(await verifyPassword(hash, password)).toBe(true);
  });
});

describe('política de contraseñas', () => {
  it('exige al menos 12 caracteres', () => {
    expect(MIN_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});
