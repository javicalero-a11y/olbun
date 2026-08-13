import 'server-only';

import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';

import { logger } from '@/lib/logger';
import { serverEnv } from '@/lib/env';

/**
 * Where document bytes live (SPEC §4.6, M9).
 *
 * S3-compatible throughout, so the same code runs against MinIO on a laptop
 * and against real object storage in production; only the endpoint and the
 * credentials differ.
 *
 * Two decisions worth keeping:
 *
 * **Keys are content-addressed, not name-addressed.** The key is the sha256 of
 * the bytes, so the same file uploaded twice occupies one object, a rename
 * cannot orphan anything, and the stored name is metadata rather than
 * identity. For a system whose job is evidence, that also means the key is a
 * checksum: if the object is intact, the bytes are the bytes.
 *
 * **Nothing is ever overwritten.** A new version is a new object under its own
 * key. Documents are evidence; a store where uploading can replace what is
 * already there is not one you can rely on in a dispute.
 */

let clienteCache: S3Client | undefined;

function cliente(): S3Client {
  const env = serverEnv();

  clienteCache ??= new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    // MinIO serves buckets as a path, not a subdomain.
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    },
  });

  return clienteCache;
}

/** Test-only: the client caches an endpoint, and tests change it. */
export function reiniciarClienteAlmacenamiento(): void {
  clienteCache = undefined;
}

export function huellaDeContenido(contenido: Buffer): string {
  return createHash('sha256').update(contenido).digest('hex');
}

/**
 * The object key for some bytes.
 *
 * Sharded by the first two hex characters: a flat prefix with hundreds of
 * thousands of objects under it is slow to list and unpleasant to browse, and
 * every object store's guidance says the same thing.
 */
export function claveDe(organisationId: string, sha256: string): string {
  return `${organisationId}/${sha256.slice(0, 2)}/${sha256}`;
}

/**
 * Makes sure the bucket exists.
 *
 * Called on the first write rather than at boot: a developer who has just run
 * `pnpm db:up` should not have to know that a bucket is a separate step, and
 * the call is a no-op once it exists.
 */
async function asegurarBucket(): Promise<void> {
  const bucket = serverEnv().S3_BUCKET;

  try {
    await cliente().send(new HeadBucketCommand({ Bucket: bucket }));
    return;
  } catch {
    // Falls through to creation; a genuine permissions problem will surface
    // there with a better message than a HEAD's opaque 403.
  }

  try {
    await cliente().send(new CreateBucketCommand({ Bucket: bucket }));
    logger.info({ bucket }, 'Bucket de documentos creado');
  } catch (error) {
    // Two uploads racing on a fresh install both try to create it; the loser
    // gets an "already owned by you", which is the outcome it wanted anyway.
    logger.debug({ bucket, error }, 'El bucket ya existía o no pudo crearse');
  }
}

export interface ObjetoGuardado {
  clave: string;
  sha256: string;
  tamano: number;
  /** True when these exact bytes were already stored under this key. */
  yaExistia: boolean;
}

/**
 * Stores bytes and returns where they went.
 *
 * Idempotent by construction: the key is derived from the content, so writing
 * the same bytes twice is the same object. The caller still gets told whether
 * it was already there, because "this file is already in the expediente" is
 * something a person wants to know.
 */
export async function guardarObjeto(
  organisationId: string,
  contenido: Buffer,
  metadatos: { nombre: string; mimeType: string },
): Promise<ObjetoGuardado> {
  await asegurarBucket();

  const sha256 = huellaDeContenido(contenido);
  const clave = claveDe(organisationId, sha256);
  const bucket = serverEnv().S3_BUCKET;

  let yaExistia = false;
  try {
    await cliente().send(new GetObjectCommand({ Bucket: bucket, Key: clave }));
    yaExistia = true;
  } catch {
    yaExistia = false;
  }

  if (!yaExistia) {
    await cliente().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: clave,
        Body: contenido,
        ContentType: metadatos.mimeType,
        // The original filename rides along so an object recovered from the
        // bucket alone is still identifiable without the database.
        Metadata: { nombre: encodeURIComponent(metadatos.nombre) },
        ChecksumAlgorithm: 'SHA256',
      }),
    );
  }

  return { clave, sha256, tamano: contenido.byteLength, yaExistia };
}

/**
 * Reads bytes back, verifying they are what was asked for.
 *
 * The hash is re-checked on the way out rather than trusted. It costs a pass
 * over the buffer and it is the difference between "the store says this is the
 * document" and "this is the document" — which is the whole claim being made
 * when a file is handed to a lawyer or an inspector.
 */
export async function leerObjeto(clave: string, sha256Esperado: string): Promise<Buffer> {
  const respuesta = await cliente().send(
    new GetObjectCommand({ Bucket: serverEnv().S3_BUCKET, Key: clave }),
  );

  if (!respuesta.Body) {
    throw new Error(`El objeto ${clave} no tiene contenido.`);
  }

  const contenido = Buffer.from(await respuesta.Body.transformToByteArray());
  const sha256 = huellaDeContenido(contenido);

  if (sha256 !== sha256Esperado) {
    logger.error({ clave, sha256, sha256Esperado }, 'Integridad del documento comprometida');
    throw new Error(
      'El documento almacenado no coincide con su huella. No se entrega un fichero que no se puede acreditar.',
    );
  }

  return contenido;
}
