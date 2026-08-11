import { beforeAll, describe, expect, it } from 'vitest';
import { Secret, TOTP } from 'otpauth';

import {
  consumirCodigoRecuperacion,
  generarAltaMfa,
  generarCodigosRecuperacion,
  hashCodigoRecuperacion,
  requiereMfaObligatoria,
  verificarCodigoMfa,
} from './mfa';
import { resetServerEnvCache } from '@/lib/env';

beforeAll(() => {
  process.env['ENCRYPTION_KEY'] = Buffer.alloc(32, 3).toString('base64');
  resetServerEnvCache();
});

/** Produces the code an authenticator app would show for a given secret. */
function codigoActual(base32: string, desplazamientoSegundos = 0): string {
  const totp = new TOTP({
    issuer: 'Olbun',
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(base32),
  });

  return totp.generate({ timestamp: Date.now() + desplazamientoSegundos * 1000 });
}

describe('requiereMfaObligatoria', () => {
  it('la exige a los roles que lo ven todo', () => {
    expect(requiereMfaObligatoria('OWNER')).toBe(true);
    expect(requiereMfaObligatoria('ORG_ADMIN')).toBe(true);
  });

  it('no la exige al resto', () => {
    for (const role of [
      'GESTOR_CONTRATO',
      'JURIDICO',
      'RRHH',
      'VIEWER',
      'CONTRIBUTOR',
    ] as const) {
      expect(requiereMfaObligatoria(role), role).toBe(false);
    }
  });
});

describe('generarAltaMfa', () => {
  it('devuelve una URL otpauth utilizable', () => {
    const alta = generarAltaMfa('ana@ejemplo.test');

    expect(alta.urlOtpauth).toMatch(/^otpauth:\/\/totp\//);
    expect(alta.urlOtpauth).toContain('issuer=Olbun');
    expect(alta.urlOtpauth).toContain('digits=6');
    expect(alta.urlOtpauth).toContain('period=30');
  });

  it('nunca guarda el secreto en claro', () => {
    const alta = generarAltaMfa('ana@ejemplo.test');

    expect(alta.secretoCifrado).not.toContain(alta.secretoLegible);
    expect(alta.secretoCifrado.startsWith('v1.')).toBe(true);
  });

  it('genera un secreto distinto por alta', () => {
    expect(generarAltaMfa('a@b.test').secretoLegible).not.toBe(
      generarAltaMfa('a@b.test').secretoLegible,
    );
  });
});

describe('verificarCodigoMfa', () => {
  it('acepta el código vigente', () => {
    const alta = generarAltaMfa('ana@ejemplo.test');

    expect(verificarCodigoMfa(alta.secretoCifrado, codigoActual(alta.secretoLegible))).toBe(
      true,
    );
  });

  it('acepta el código escrito con un espacio en medio', () => {
    const alta = generarAltaMfa('ana@ejemplo.test');
    const codigo = codigoActual(alta.secretoLegible);

    expect(
      verificarCodigoMfa(alta.secretoCifrado, `${codigo.slice(0, 3)} ${codigo.slice(3)}`),
    ).toBe(true);
  });

  it('tolera un desfase de reloj de ±30 segundos', () => {
    const alta = generarAltaMfa('ana@ejemplo.test');

    expect(
      verificarCodigoMfa(alta.secretoCifrado, codigoActual(alta.secretoLegible, -30)),
    ).toBe(true);
    expect(verificarCodigoMfa(alta.secretoCifrado, codigoActual(alta.secretoLegible, 30))).toBe(
      true,
    );
  });

  it('rechaza un código de hace varios minutos', () => {
    const alta = generarAltaMfa('ana@ejemplo.test');

    expect(
      verificarCodigoMfa(alta.secretoCifrado, codigoActual(alta.secretoLegible, -300)),
    ).toBe(false);
  });

  it('rechaza el código de otro secreto', () => {
    const uno = generarAltaMfa('ana@ejemplo.test');
    const otro = generarAltaMfa('ana@ejemplo.test');

    expect(verificarCodigoMfa(uno.secretoCifrado, codigoActual(otro.secretoLegible))).toBe(
      false,
    );
  });

  it('rechaza formatos que no son seis dígitos', () => {
    const alta = generarAltaMfa('ana@ejemplo.test');

    for (const malo of ['', '12345', '1234567', 'abcdef', '12-34-56']) {
      expect(verificarCodigoMfa(alta.secretoCifrado, malo), malo).toBe(false);
    }
  });

  it('devuelve false, sin lanzar, si el secreto almacenado está corrupto', () => {
    expect(verificarCodigoMfa('no-es-un-secreto-cifrado', '123456')).toBe(false);
  });
});

describe('códigos de recuperación', () => {
  it('genera diez códigos únicos con sus hashes', () => {
    const { codigos, hashes } = generarCodigosRecuperacion();

    expect(codigos).toHaveLength(10);
    expect(new Set(codigos).size).toBe(10);
    expect(hashes).toHaveLength(10);
    expect(hashes[0]).toBe(hashCodigoRecuperacion(codigos[0] ?? ''));
  });

  it('no almacena el código en claro', () => {
    const { codigos, hashes } = generarCodigosRecuperacion();

    for (const codigo of codigos) {
      expect(hashes.some((h) => h.includes(codigo))).toBe(false);
    }
  });

  it('consume un código válido y lo retira de la lista', () => {
    const { codigos, hashes } = generarCodigosRecuperacion();
    const usado = codigos[3] ?? '';

    const resultado = consumirCodigoRecuperacion(hashes, usado);

    expect(resultado.valido).toBe(true);
    expect(resultado.restantes).toHaveLength(9);
    expect(resultado.restantes).not.toContain(hashCodigoRecuperacion(usado));
  });

  it('un código sólo sirve una vez', () => {
    const { codigos, hashes } = generarCodigosRecuperacion();
    const usado = codigos[0] ?? '';

    const primera = consumirCodigoRecuperacion(hashes, usado);
    const segunda = consumirCodigoRecuperacion(primera.restantes, usado);

    expect(primera.valido).toBe(true);
    expect(segunda.valido).toBe(false);
    expect(segunda.restantes).toHaveLength(9);
  });

  it('acepta el código en minúsculas y con espacios', () => {
    const { codigos, hashes } = generarCodigosRecuperacion();
    const usado = codigos[0] ?? '';

    expect(consumirCodigoRecuperacion(hashes, `  ${usado.toLowerCase()}  `).valido).toBe(true);
  });

  it('rechaza un código que no existe', () => {
    const { hashes } = generarCodigosRecuperacion();

    const resultado = consumirCodigoRecuperacion(hashes, 'AAAAA-BBBBB');

    expect(resultado.valido).toBe(false);
    expect(resultado.restantes).toHaveLength(10);
  });

  it('rechaza sobre una lista vacía sin lanzar', () => {
    expect(consumirCodigoRecuperacion([], 'AAAAA-BBBBB').valido).toBe(false);
  });
});
