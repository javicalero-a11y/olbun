import { beforeAll, describe, expect, it } from 'vitest';

import { resetServerEnvCache } from '@/lib/env';
import { cifrarObjeto, descifrarObjeto, indiceNif } from './datos-personales';

beforeAll(() => {
  process.env['ENCRYPTION_KEY'] = Buffer.alloc(32, 9).toString('base64');
  resetServerEnvCache();
});

describe('datos personales cifrados', () => {
  it('cifra y recupera un objeto sin texto plano visible', () => {
    const cifrado = cifrarObjeto({ nif: '12345678Z', complemento: 127.4 });
    expect(cifrado).not.toContain('12345678Z');
    expect(descifrarObjeto(cifrado)).toEqual({ nif: '12345678Z', complemento: 127.4 });
  });

  it('genera un índice estable tras normalizar el NIF', () => {
    expect(indiceNif('12.345.678-z')).toBe(indiceNif('12345678Z'));
    expect(indiceNif('12345678Z')).not.toBe(indiceNif('00000000T'));
  });
});
