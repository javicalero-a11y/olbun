import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Secret, TOTP } from 'otpauth';
import type { Role } from '@prisma/client';

import { cifrar, descifrar } from '@/lib/crypto/cifrado';

/**
 * TOTP two-factor authentication (SPEC §7.4).
 *
 * Mandatory for OWNER and ORG_ADMIN: those roles can read every expediente,
 * every payroll figure and the whole audit log, so a stolen password must not
 * be enough on its own.
 */

const EMISOR = 'Olbun';
const DIGITOS = 6;
const PERIODO_SEGUNDOS = 30;

/**
 * One step of tolerance either side, i.e. ±30 s. Enough for ordinary clock
 * drift on a phone; wide enough windows meaningfully extend how long an
 * intercepted code stays usable.
 */
const VENTANA = 1;

const ROLES_CON_MFA_OBLIGATORIA: readonly Role[] = ['OWNER', 'ORG_ADMIN'];

export function requiereMfaObligatoria(role: Role): boolean {
  return ROLES_CON_MFA_OBLIGATORIA.includes(role);
}

export interface AltaMfa {
  /** Encrypted, ready to store. */
  secretoCifrado: string;
  /** Shown once, for manual entry when a QR cannot be scanned. */
  secretoLegible: string;
  /** `otpauth://` URI the authenticator app consumes. */
  urlOtpauth: string;
}

export function generarAltaMfa(email: string): AltaMfa {
  const secret = new Secret({ size: 20 });

  const totp = new TOTP({
    issuer: EMISOR,
    label: email,
    algorithm: 'SHA1',
    digits: DIGITOS,
    period: PERIODO_SEGUNDOS,
    secret,
  });

  return {
    secretoCifrado: cifrar(secret.base32),
    secretoLegible: secret.base32,
    urlOtpauth: totp.toString(),
  };
}

/**
 * Validates a code against the stored (encrypted) secret. Accepts the code with
 * or without the space users often type in the middle.
 */
export function verificarCodigoMfa(secretoCifrado: string, codigo: string): boolean {
  const limpio = codigo.replace(/\s+/g, '');

  if (!/^\d{6}$/.test(limpio)) return false;

  let secretoBase32: string;
  try {
    secretoBase32 = descifrar(secretoCifrado);
  } catch {
    return false;
  }

  const totp = new TOTP({
    issuer: EMISOR,
    algorithm: 'SHA1',
    digits: DIGITOS,
    period: PERIODO_SEGUNDOS,
    secret: Secret.fromBase32(secretoBase32),
  });

  return totp.validate({ token: limpio, window: VENTANA }) !== null;
}

/** Recovery codes, for a lost phone. Shown once at enrolment. */
export function generarCodigosRecuperacion(cantidad = 10): {
  codigos: string[];
  hashes: string[];
} {
  const codigos = Array.from({ length: cantidad }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });

  return { codigos, hashes: codigos.map(hashCodigoRecuperacion) };
}

/**
 * SHA-256 is appropriate here, unlike for passwords: these are 40 bits of
 * uniform randomness that nobody chose, so there is no dictionary to run and
 * no benefit from a slow KDF.
 */
export function hashCodigoRecuperacion(codigo: string): string {
  return createHash('sha256').update(codigo.trim().toUpperCase()).digest('hex');
}

/**
 * Consumes a recovery code, returning the remaining hashes. Comparison is
 * constant-time, and a used code is removed by the caller persisting the
 * returned list.
 */
export function consumirCodigoRecuperacion(
  hashesAlmacenados: readonly string[],
  codigo: string,
): { valido: boolean; restantes: string[] } {
  const objetivo = Buffer.from(hashCodigoRecuperacion(codigo), 'hex');

  const indice = hashesAlmacenados.findIndex((almacenado) => {
    const candidato = Buffer.from(almacenado, 'hex');
    return candidato.length === objetivo.length && timingSafeEqual(candidato, objetivo);
  });

  if (indice === -1) return { valido: false, restantes: [...hashesAlmacenados] };

  return {
    valido: true,
    restantes: hashesAlmacenados.filter((_, i) => i !== indice),
  };
}
