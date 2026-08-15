import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

import { serverEnv } from '@/lib/env';
import { normalizarNif } from '@/lib/domain/personal/identificadores';

const VERSION = 'v1';
const IV_BYTES = 12;

interface Clave {
  id: string;
  material: Buffer;
}

function analizarClave(valor: string): Clave {
  const material = Buffer.from(valor, 'base64');
  if (material.length !== 32) {
    throw new Error('ENCRYPTION_KEY debe ser de 32 bytes codificados en base64');
  }
  return { id: material.subarray(0, 4).toString('hex'), material };
}

function clavesDisponibles(): Clave[] {
  const entorno = serverEnv();
  const anteriores =
    entorno.ENCRYPTION_PREVIOUS_KEYS?.split(',')
      .map((valor) => valor.trim())
      .filter(Boolean) ?? [];
  return [entorno.ENCRYPTION_KEY, ...anteriores].map(analizarClave);
}

function claveActual(): Clave {
  const [actual] = clavesDisponibles();
  if (!actual) throw new Error('No hay una clave de cifrado disponible');
  return actual;
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
  const [, keyId, ivB64, tagB64, cifradoB64] = partes;
  if (!ivB64 || !tagB64 || cifradoB64 === undefined) {
    throw new Error('Valor cifrado incompleto');
  }

  const clave = clavesDisponibles().find((candidata) => candidata.id === keyId);
  if (!clave)
    throw new Error(`La clave de cifrado ${keyId ?? 'desconocida'} no está disponible`);
  const { material } = clave;
  const decipher = createDecipheriv('aes-256-gcm', material, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(cifradoB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function indiceCiegoNif(nif: string): string {
  return indiceConClave(nif, claveActual());
}

export function indicesCiegosNif(nif: string): string[] {
  return clavesDisponibles().map((clave) => indiceConClave(nif, clave));
}

function indiceConClave(nif: string, clave: Clave): string {
  return createHmac('sha256', clave.material)
    .update(`olbun:nif:v1:${normalizarNif(nif)}`)
    .digest('hex');
}
