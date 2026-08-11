import 'server-only';

import { identityClientBecause } from '@/lib/db/tenant';
import { verifyPassword } from '@/lib/auth/password';
import { consumirCodigoRecuperacion, verificarCodigoMfa } from '@/lib/auth/mfa';
import { logger } from '@/lib/logger';

/**
 * Credential verification, shared by the sign-in server action and by Auth.js's
 * `authorize`. Keeping it in one place means the lockout counter, the timing
 * defence and the MFA rules cannot drift apart between the two paths.
 */

/** SPEC §7.4: 5 failed attempts per 15 minutes. */
const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 15;

/**
 * A valid argon2id hash of a value nobody knows, used to spend comparable time
 * on unknown addresses as on real ones so response timing does not reveal which
 * accounts exist.
 */
const HASH_SEÑUELO =
  '$argon2id$v=19$m=65536,t=3,p=4$c2VudWVsb3NlbnVlbG9zZW51ZWxv$JXm8vN3sQb0dGm4Zx1pQm2y3M4c5R6t7U8i9O0p1A2s';

export type ResultadoAcceso =
  | { estado: 'OK'; userId: string; email: string; nombre: string }
  | { estado: 'CREDENCIALES_INVALIDAS' }
  | { estado: 'BLOQUEADA' }
  | { estado: 'MFA_REQUERIDA' }
  | { estado: 'MFA_INVALIDA' };

export async function verificarCredenciales(
  email: string,
  password: string,
  codigo?: string,
): Promise<ResultadoAcceso> {
  const db = identityClientBecause('sign-in resolves a user before any organisation is known');

  const usuario = await db.user.findFirst({
    where: { email, deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      failedLoginCount: true,
      lockedUntil: true,
      mfaEnabled: true,
      mfaSecret: true,
      mfaRecoveryCodes: true,
    },
  });

  if (!usuario?.passwordHash) {
    await verifyPassword(HASH_SEÑUELO, password);
    return { estado: 'CREDENCIALES_INVALIDAS' };
  }

  if (usuario.lockedUntil && usuario.lockedUntil > new Date()) {
    logger.warn({ userId: usuario.id }, 'Intento de acceso sobre cuenta bloqueada');
    return { estado: 'BLOQUEADA' };
  }

  if (!(await verifyPassword(usuario.passwordHash, password))) {
    const failedLoginCount = usuario.failedLoginCount + 1;
    const lockedUntil =
      failedLoginCount >= MAX_INTENTOS
        ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000)
        : null;

    await db.user.update({
      where: { id: usuario.id },
      data: { failedLoginCount, lockedUntil },
    });

    return { estado: 'CREDENCIALES_INVALIDAS' };
  }

  // The password is correct from here on, so revealing that a second factor is
  // expected discloses nothing the caller does not already know.
  if (usuario.mfaEnabled && usuario.mfaSecret) {
    if (!codigo) return { estado: 'MFA_REQUERIDA' };

    const codigoValido = verificarCodigoMfa(usuario.mfaSecret, codigo);

    if (!codigoValido) {
      const recuperacion = consumirCodigoRecuperacion(usuario.mfaRecoveryCodes, codigo);

      if (!recuperacion.valido) return { estado: 'MFA_INVALIDA' };

      await db.user.update({
        where: { id: usuario.id },
        data: { mfaRecoveryCodes: recuperacion.restantes },
      });

      logger.warn({ userId: usuario.id }, 'Acceso mediante código de recuperación');
    }
  }

  await db.user.update({
    where: { id: usuario.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });

  return { estado: 'OK', userId: usuario.id, email: usuario.email, nombre: usuario.name };
}
