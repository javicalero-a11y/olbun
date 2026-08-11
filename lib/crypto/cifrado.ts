import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { serverEnv } from '@/lib/env';

/**
 * Authenticated encryption for fields that must not be readable in a database
 * dump: TOTP secrets now, and from M11 the personal data in
 * `Empleado.emergencyContact` and `Incident.personasImplicadas` (SPEC §7.3).
 *
 * AES-256-GCM, random 96-bit IV per value, authentication tag stored alongside.
 * The output is self-describing so a future key rotation can identify which key
 * encrypted a given value:
 *
 *     v1.<keyId>.<iv-b64url>.<tag-b64url>.<ciphertext-b64url>
 *
 * **Known gap:** the key comes from the environment, not from a KMS, so this
 * protects a leaked backup but not a compromised application host. Envelope
 * encryption with a KMS-held master key is M23 (hardening), and the format
 * above is what makes that migration possible without a full re-encrypt.
 */

const VERSION = 'v1';
const IV_BYTES = 12;

interface Clave {
  id: string;
  material: Buffer;
}

function claveActual(): Clave {
  const raw = serverEnv().ENCRYPTION_KEY;
  const material = Buffer.from(raw, 'base64');

  if (material.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser de 32 bytes codificados en base64');
  }

  // Key identifier derived from the key itself, so rotating the environment
  // variable automatically changes the id without a separate register.
  const id = material.subarray(0, 4).toString('hex');

  return { id, material };
}

export function cifrar(textoPlano: string): string {
  const { id, material } = claveActual();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', material, iv);

  const cifrado = Buffer.concat([cipher.update(textoPlano, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    id,
    iv.toString('base64url'),
    tag.toString('base64url'),
    cifrado.toString('base64url'),
  ].join('.');
}

export function descifrar(valor: string): string {
  const partes = valor.split('.');

  if (partes.length !== 5 || partes[0] !== VERSION) {
    throw new Error('Valor cifrado con formato desconocido');
  }

  const [, , ivB64, tagB64, cifradoB64] = partes;

  if (!ivB64 || !tagB64 || cifradoB64 === undefined) {
    throw new Error('Valor cifrado incompleto');
  }

  const { material } = claveActual();
  const decipher = createDecipheriv('aes-256-gcm', material, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(cifradoB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
