import 'server-only';

import type { TenantTransactionClient } from '@/lib/db/tenant';

export interface CambioDocumento {
  id: string;
  nombre: string;
  antes: Record<string, unknown>;
  despues: Record<string, unknown>;
}

export async function cambiarBloqueoLegal(
  db: TenantTransactionClient,
  documentoId: string,
  usuarioId: string,
  bloquear: boolean,
  motivo: string,
  ahora: Date = new Date(),
): Promise<CambioDocumento> {
  const documento = await db.documento.findFirst({
    where: { id: documentoId, deletedAt: null },
    select: {
      id: true,
      nombre: true,
      bloqueadoPorLitigio: true,
      bloqueadoEn: true,
      bloqueadoPorId: true,
      motivoBloqueo: true,
    },
  });
  if (!documento) throw new Error('El documento no existe.');
  if (documento.bloqueadoPorLitigio === bloquear) {
    throw new Error(
      bloquear ? 'El documento ya tiene un bloqueo legal.' : 'El documento no está bloqueado.',
    );
  }

  await db.documento.update({
    where: { id: documento.id },
    data: bloquear
      ? {
          bloqueadoPorLitigio: true,
          bloqueadoEn: ahora,
          bloqueadoPorId: usuarioId,
          motivoBloqueo: motivo,
        }
      : {
          bloqueadoPorLitigio: false,
          bloqueadoEn: null,
          bloqueadoPorId: null,
          motivoBloqueo: null,
        },
  });

  return {
    id: documento.id,
    nombre: documento.nombre,
    antes: {
      bloqueadoPorLitigio: documento.bloqueadoPorLitigio,
      bloqueadoEn: documento.bloqueadoEn,
      bloqueadoPorId: documento.bloqueadoPorId,
      motivoBloqueo: documento.motivoBloqueo,
    },
    despues: bloquear
      ? { bloqueadoPorLitigio: true, bloqueadoEn: ahora, motivoBloqueo: motivo }
      : { bloqueadoPorLitigio: false, motivoRetirada: motivo },
  };
}

/** Moves a live document to recoverable trash without touching versions/bytes. */
export async function enviarAPapelera(
  db: TenantTransactionClient,
  documentoId: string,
  usuarioId: string,
  motivo: string,
  ahora: Date = new Date(),
): Promise<CambioDocumento> {
  const documento = await db.documento.findFirst({
    where: { id: documentoId, deletedAt: null },
    select: { id: true, nombre: true, bloqueadoPorLitigio: true },
  });
  if (!documento) throw new Error('El documento no existe.');
  if (documento.bloqueadoPorLitigio) {
    throw new Error('El documento tiene un bloqueo legal y no puede enviarse a la papelera.');
  }

  await db.documento.update({
    where: { id: documento.id },
    data: {
      deletedAt: ahora,
      deletedById: usuarioId,
      motivoBorrado: motivo,
      restoredAt: null,
      restoredById: null,
    },
  });

  return {
    id: documento.id,
    nombre: documento.nombre,
    antes: { deletedAt: null },
    despues: { deletedAt: ahora, deletedById: usuarioId, motivoBorrado: motivo },
  };
}

/** Restores identity and versions; bytes were never removed by soft deletion. */
export async function restaurarDesdePapelera(
  db: TenantTransactionClient,
  documentoId: string,
  usuarioId: string,
  ahora: Date = new Date(),
): Promise<CambioDocumento> {
  const documento = await db.documento.findFirst({
    where: { id: documentoId, deletedAt: { not: null } },
    select: { id: true, nombre: true, deletedAt: true, deletedById: true, motivoBorrado: true },
  });
  if (!documento) throw new Error('El documento no existe en la papelera.');

  await db.documento.update({
    where: { id: documento.id },
    data: {
      deletedAt: null,
      deletedById: null,
      motivoBorrado: null,
      restoredAt: ahora,
      restoredById: usuarioId,
    },
  });

  return {
    id: documento.id,
    nombre: documento.nombre,
    antes: {
      deletedAt: documento.deletedAt,
      deletedById: documento.deletedById,
      motivoBorrado: documento.motivoBorrado,
    },
    despues: { deletedAt: null, restoredAt: ahora, restoredById: usuarioId },
  };
}
