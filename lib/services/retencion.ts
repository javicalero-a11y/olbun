import 'server-only';

import { evaluarRetencion } from '@/lib/domain/documentos/retencion';
import { borrarObjeto } from '@/lib/storage/objetos';
import type { Retencion } from '@/lib/domain/documentos/retencion';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * Applying the retention policy to real documents (SPEC §4.6, M9).
 *
 * The domain module decides *whether* something has expired. This one works out
 * *what to ask it about* and, when a person confirms, carries out the purge.
 *
 * Nothing here runs on a timer. A scheduled job that deletes evidence while
 * nobody is looking is not a feature anybody asked for, and the RGPD does not
 * require deletion be automatic — only that it happen. So: the application
 * lists what has come due, a person with `documento:delete` confirms, and the
 * audit log records who did it and when.
 */

export interface DocumentoConRetencion {
  id: string;
  nombre: string;
  tipoNombre: string | null;
  /** Where the clock started, and why it started there. */
  inicio: Date;
  origenInicio: 'FIN_DE_CONTRATO' | 'FECHA_DEL_DOCUMENTO';
  versiones: number;
  retencion: Retencion;
}

/**
 * Picks the date the retention clock runs from.
 *
 * Retention runs from the end of the relationship the paperwork documents, not
 * from the day somebody uploaded the file — a contract closed in 2019 whose
 * pliego was scanned in 2024 is not owed five more years because of when the
 * scanning happened. Where there is no contract end date, the document's own
 * date is the honest fallback and the screen says which one was used.
 */
function inicioDeRetencion(documento: {
  createdAt: Date;
  contrato: { fechaFinPrevista: Date | null } | null;
}): { inicio: Date; origen: DocumentoConRetencion['origenInicio'] } {
  const fin = documento.contrato?.fechaFinPrevista ?? null;

  return fin && fin > documento.createdAt
    ? { inicio: fin, origen: 'FIN_DE_CONTRATO' }
    : { inicio: documento.createdAt, origen: 'FECHA_DEL_DOCUMENTO' };
}

const SELECCION = {
  id: true,
  nombre: true,
  createdAt: true,
  bloqueadoPorLitigio: true,
  tipo: { select: { nombre: true, retencionAnios: true } },
  contrato: { select: { fechaFinPrevista: true } },
  _count: { select: { versiones: { where: { deletedAt: null } } } },
} as const;

/** Everything live, with its retention state worked out. */
export async function documentosConRetencion(
  db: TenantTransactionClient,
  hoy: Date = new Date(),
): Promise<DocumentoConRetencion[]> {
  const documentos = await db.documento.findMany({
    where: { deletedAt: null },
    select: SELECCION,
    orderBy: { createdAt: 'asc' },
  });

  return documentos.map((documento) => {
    const { inicio, origen } = inicioDeRetencion(documento);

    return {
      id: documento.id,
      nombre: documento.nombre,
      tipoNombre: documento.tipo?.nombre ?? null,
      inicio,
      origenInicio: origen,
      versiones: documento._count.versiones,
      retencion: evaluarRetencion({
        inicio,
        retencionAnios: documento.tipo?.retencionAnios ?? null,
        bloqueadoPorLitigio: documento.bloqueadoPorLitigio,
        hoy,
      }),
    };
  });
}

export interface ResumenRetencion {
  caducados: DocumentoConRetencion[];
  porCaducar: DocumentoConRetencion[];
  sinPolitica: number;
  bloqueados: number;
  total: number;
}

export async function resumenDeRetencion(
  db: TenantTransactionClient,
  hoy: Date = new Date(),
): Promise<ResumenRetencion> {
  const todos = await documentosConRetencion(db, hoy);

  return {
    caducados: todos.filter((documento) => documento.retencion.estado === 'CADUCADO'),
    porCaducar: todos.filter((documento) => documento.retencion.estado === 'POR_CADUCAR'),
    sinPolitica: todos.filter((documento) => documento.retencion.estado === 'SIN_POLITICA')
      .length,
    bloqueados: todos.filter((documento) => documento.retencion.estado === 'BLOQUEADO').length,
    total: todos.length,
  };
}

export interface ResultadoPurga {
  nombre: string;
  versionesBorradas: number;
  /** Objects whose bytes were removed. Fewer than versions when they dedupe. */
  objetosBorrados: number;
}

/**
 * Purges one document, having checked again that it may be purged.
 *
 * The check is repeated here rather than trusted from the list the person was
 * looking at. That list may be minutes old, and in those minutes somebody may
 * have put the document under a litigation hold. Re-reading is cheap; deleting
 * evidence in a live dispute is not.
 *
 * The rows are soft-deleted and the bytes are hard-deleted, which is the shape
 * the obligation actually has: the RGPD wants the personal data gone, and the
 * audit trail wants a record that the document existed and was purged. A row
 * saying "this was purged on this date by this person" carries no document
 * content and is the evidence that the policy was applied.
 */
export async function purgarDocumento(
  db: TenantTransactionClient,
  documentoId: string,
  usuarioId: string,
  hoy: Date = new Date(),
): Promise<ResultadoPurga> {
  const documento = await db.documento.findFirst({
    where: { id: documentoId, deletedAt: null },
    select: {
      ...SELECCION,
      versiones: { where: { deletedAt: null }, select: { id: true, storageKey: true } },
    },
  });

  if (!documento) throw new Error('El documento no existe.');

  const { inicio } = inicioDeRetencion(documento);
  const retencion = evaluarRetencion({
    inicio,
    retencionAnios: documento.tipo?.retencionAnios ?? null,
    bloqueadoPorLitigio: documento.bloqueadoPorLitigio,
    hoy,
  });

  if (!retencion.purgable) {
    throw new Error(
      documento.bloqueadoPorLitigio
        ? 'El documento está bloqueado por litigio y no puede purgarse.'
        : 'El documento todavía está dentro de su plazo de conservación.',
    );
  }

  const claves = documento.versiones.map((version) => version.storageKey);

  await db.versionDocumento.updateMany({
    where: { documentoId, deletedAt: null },
    data: { deletedAt: hoy },
  });

  await db.documento.update({
    where: { id: documentoId },
    data: { deletedAt: hoy, deletedById: usuarioId },
  });

  // Only now, and only for keys nothing else points at. Objects are addressed
  // by content, so an identical file uploaded to another expediente shares this
  // key — removing the bytes would empty a document nobody purged.
  let objetosBorrados = 0;

  for (const clave of new Set(claves)) {
    const enUso = await db.versionDocumento.count({
      where: { storageKey: clave, deletedAt: null },
    });

    if (enUso === 0) {
      await borrarObjeto(clave);
      objetosBorrados += 1;
    }
  }

  return {
    nombre: documento.nombre,
    versionesBorradas: documento.versiones.length,
    objetosBorrados,
  };
}
