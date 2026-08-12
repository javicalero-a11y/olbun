/**
 * Who may sign in through a provider that is not the password form.
 *
 * Two risks decide every rule here.
 *
 * **Account takeover by assertion.** If we attach a Google account to an
 * existing user merely because the addresses match, then anyone who can get an
 * identity provider to assert someone's address inherits their expedientes. So
 * linking requires the provider to state that it verified the address. A magic
 * link needs no such check: delivering to the mailbox *is* the proof.
 *
 * **Silent downgrade of the second factor.** TOTP is mandatory for OWNER and
 * ORG_ADMIN (SPEC §7.4), and it is enforced inside the password path. A person
 * with MFA enabled who signs in with Google would skip it entirely — the
 * accounts holding the most sensitive litigation data would be the easiest to
 * reach. So an account with MFA enabled is refused every non-password route
 * and told to use its password. This is deliberately strict: it means linking
 * Google and later enabling MFA turns the Google button off for that account,
 * and the message says so rather than failing mysteriously.
 */

export type ProveedorAcceso = 'oauth' | 'email';

/**
 * The tenant every personal Microsoft account is issued from. A fixed GUID
 * published by Microsoft, not a value that varies by deployment.
 */
export const TENANT_CUENTAS_PERSONALES = '9188040d-6c67-4c5b-b112-36a304b66dad';

/**
 * Whether the provider is telling us it checked the address.
 *
 * Google says so outright with `email_verified`. **Microsoft Entra does not
 * emit that claim at all**, so taking its absence as "unverified" would refuse
 * every Microsoft sign-in, and taking it as "verified" would accept personal
 * Microsoft accounts on somebody's word.
 *
 * The rule instead: an Entra token counts as verified when it comes from a real
 * organisational directory, because there the address is provisioned and
 * controlled by that organisation's IT — stronger assurance than a
 * self-asserted email, not weaker. A token from the personal-accounts tenant
 * gets no such credit.
 */
export function correoVerificadoPor(
  provider: string,
  claims: Record<string, unknown> | null | undefined,
): boolean {
  if (!claims) return false;

  if (provider === 'microsoft-entra-id') {
    const tid = claims['tid'];
    return typeof tid === 'string' && tid.length > 0 && tid !== TENANT_CUENTAS_PERSONALES;
  }

  // Google and anything else OIDC-shaped: only an explicit true counts.
  return claims['email_verified'] === true;
}

export type MotivoRechazo =
  /** The provider would not confirm it had verified the address. */
  | 'CORREO_NO_VERIFICADO'
  /** The account uses a second factor, which this route cannot ask for. */
  | 'REQUIERE_SEGUNDO_FACTOR'
  /** The account is locked or has been deleted. */
  | 'CUENTA_NO_DISPONIBLE';

export interface UsuarioExistente {
  mfaEnabled: boolean;
  /** True when this exact provider account is already attached to the user. */
  yaVinculado: boolean;
  bloqueada: boolean;
}

export type DecisionAcceso = { permitido: true } | { permitido: false; motivo: MotivoRechazo };

export interface EntradaPolitica {
  proveedor: ProveedorAcceso;
  /** What the identity provider says about the address. Ignored for magic links. */
  correoVerificadoPorProveedor?: boolean | undefined;
  /** Null when nobody holds this address yet, so a new account will be created. */
  existente: UsuarioExistente | null;
}

export function decidirAcceso(entrada: EntradaPolitica): DecisionAcceso {
  const { proveedor, existente } = entrada;

  // Nobody holds this address: a new account is about to be created, and
  // there is no existing identity to take over.
  if (!existente) {
    if (proveedor === 'oauth' && entrada.correoVerificadoPorProveedor !== true) {
      // An unverified address would let someone claim an address they do not
      // control, and be waiting inside it when the real owner is invited.
      return { permitido: false, motivo: 'CORREO_NO_VERIFICADO' };
    }
    return { permitido: true };
  }

  if (existente.bloqueada) {
    return { permitido: false, motivo: 'CUENTA_NO_DISPONIBLE' };
  }

  // Checked before the linking rules on purpose: an already-linked Google
  // account must not become a way around the second factor.
  if (existente.mfaEnabled) {
    return { permitido: false, motivo: 'REQUIERE_SEGUNDO_FACTOR' };
  }

  if (proveedor === 'email') {
    // Receiving the link proves control of the mailbox, which is the same
    // thing the address itself is evidence of.
    return { permitido: true };
  }

  if (existente.yaVinculado) return { permitido: true };

  return entrada.correoVerificadoPorProveedor === true
    ? { permitido: true }
    : { permitido: false, motivo: 'CORREO_NO_VERIFICADO' };
}

/** Wording shown on the sign-in page; the codes never reach a person. */
export const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
  CORREO_NO_VERIFICADO:
    'Tu proveedor no confirma que esa dirección de correo sea tuya, así que no podemos usarla para entrar. Entra con tu contraseña.',
  REQUIERE_SEGUNDO_FACTOR:
    'Tu cuenta tiene verificación en dos pasos activada, y por ahí no podemos pedirte el código. Entra con tu contraseña y tu código de verificación.',
  CUENTA_NO_DISPONIBLE: 'No hemos podido iniciar sesión con esos datos.',
};
