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

  /**
   * Mutates the FIRST base64url character, never the last: the final character
   * of a base64 group carries only two significant bits, so flipping it often
   * decodes to the very same bytes and the "tampered" value is not tampered at
   * all. Written the other way round, this test passes or fails depending on
   * the random IV.
   */
  const alterarPrimerCaracter = (valor: string): string =>
    (valor.startsWith('A') ? 'B' : 'A') + valor.slice(1);

  it('rechaza un texto cifrado manipulado', () => {
    const partes = cifrar('valor íntegro').split('.');
    partes[4] = alterarPrimerCaracter(partes[4] ?? '');

    expect(() => descifrar(partes.join('.'))).toThrow();
  });

  it('rechaza una etiqueta de autenticación manipulada', () => {
    const partes = cifrar('valor íntegro').split('.');
    partes[3] = alterarPrimerCaracter(partes[3] ?? '');

    expect(() => descifrar(partes.join('.'))).toThrow();
  });

  it('rechaza un IV manipulado', () => {
    const partes = cifrar('valor íntegro').split('.');
    partes[2] = alterarPrimerCaracter(partes[2] ?? '');

    expect(() => descifrar(partes.join('.'))).toThrow();
  });

  it('rechaza un formato desconocido', () => {
    expect(() => descifrar('esto-no-va-cifrado')).toThrow(/formato desconocido/);
    expect(() => descifrar('v2.aaaaaaaa.a.a.a')).toThrow(/formato desconocido/);
  });
});
