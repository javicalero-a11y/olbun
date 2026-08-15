import 'server-only';

export { cifrar, descifrar } from '@/lib/crypto/cifrado-nucleo';

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
