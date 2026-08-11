import { beforeAll, describe, expect, it } from 'vitest';

import { cifrar, descifrar } from './cifrado';
import { resetServerEnvCache } from '@/lib/env';

beforeAll(() => {
  process.env['ENCRYPTION_KEY'] = Buffer.alloc(32, 7).toString('base64');
  resetServerEnvCache();
});

describe('cifrar / descifrar', () => {
  it('recupera el texto original', () => {
    const secreto = 'JBSWY3DPEHPK3PXP';
    expect(descifrar(cifrar(secreto))).toBe(secreto);
  });

  it('conserva acentos, ñ y emoji', () => {
    const texto = 'Peñarroya — contacto de emergencia: José Muñoz 🚑';
    expect(descifrar(cifrar(texto))).toBe(texto);
  });

  it('conserva la cadena vacía', () => {
    expect(descifrar(cifrar(''))).toBe('');
  });

  it('produce un resultado distinto cada vez (IV aleatorio)', () => {
    expect(cifrar('mismo valor')).not.toBe(cifrar('mismo valor'));
  });

  it('no deja el texto plano visible en la salida', () => {
    const secreto = 'zanahoria-secreta';
    expect(cifrar(secreto)).not.toContain(secreto);
  });

  it('marca la versión y el identificador de clave', () => {
    const partes = cifrar('x').split('.');
    expect(partes).toHaveLength(5);
    expect(partes[0]).toBe('v1');
    expect(partes[1]).toMatch(/^[0-9a-f]{8}$/);
  });

  it('rechaza un texto cifrado manipulado', () => {
    const cifrado = cifrar('valor íntegro');
    const partes = cifrado.split('.');
    // Flip the last character of the ciphertext.
    const ultimo = partes[4] ?? '';
    partes[4] = ultimo.slice(0, -1) + (ultimo.endsWith('A') ? 'B' : 'A');

    expect(() => descifrar(partes.join('.'))).toThrow();
  });

  it('rechaza una etiqueta de autenticación manipulada', () => {
    const partes = cifrar('valor íntegro').split('.');
    const tag = partes[3] ?? '';
    partes[3] = tag.slice(0, -1) + (tag.endsWith('A') ? 'B' : 'A');

    expect(() => descifrar(partes.join('.'))).toThrow();
  });

  it('rechaza un formato desconocido', () => {
    expect(() => descifrar('esto-no-va-cifrado')).toThrow(/formato desconocido/);
    expect(() => descifrar('v2.aaaaaaaa.a.a.a')).toThrow(/formato desconocido/);
  });
});
