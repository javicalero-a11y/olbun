import 'server-only';

import { cifrar } from '@/lib/crypto/cifrado';
import { aDate } from '@/lib/services/expedientes';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import type { IniciarConexionBuzon } from '@/lib/validation/buzones';
import {
  hashOAuth,
  nuevoSecretoOAuth,
  proveedorCorreoConfigurado,
  urlAutorizacion,
} from './oauth';

export async function crearSolicitudOAuth(
  db: TenantTransactionClient,
  organisationId: string,
  userId: string,
  datos: IniciarConexionBuzon,
): Promise<{ url: string }> {
  if (!proveedorCorreoConfigurado(datos.proveedor)) {
    throw new Error(
      `${datos.proveedor === 'GOOGLE' ? 'Google Workspace' : 'Microsoft 365'} todavía no tiene credenciales de conexión.`,
    );
  }

  if (datos.contratoId) {
    const contrato = await db.contrato.findFirst({
      where: { id: datos.contratoId, deletedAt: null },
      select: { id: true },
    });
    if (!contrato) throw new Error('El contrato seleccionado no existe.');
  }

  if (datos.politicaInternaDocumentoId) {
    const documento = await db.documento.findFirst({
      where: { id: datos.politicaInternaDocumentoId, deletedAt: null },
      select: { id: true },
    });
    if (!documento) throw new Error('La política interna seleccionada no existe.');
  }

  const state = nuevoSecretoOAuth();
  const verifier = nuevoSecretoOAuth();
  await db.solicitudOAuthBuzon.create({
    data: {
      organisationId,
      proveedor: datos.proveedor,
      stateHash: hashOAuth(state),
      pkceVerifierCifrado: cifrar(verifier),
      solicitadoPorId: userId,
      contratoId: datos.contratoId ?? null,
      esPersonal: datos.esPersonal,
      politicaInternaDocumentoId: datos.politicaInternaDocumentoId ?? null,
      consultaRepresentacionFecha: datos.consultaRepresentacionFecha
        ? aDate(datos.consultaRepresentacionFecha)
        : null,
      historicoDesde: datos.historicoDesde ? aDate(datos.historicoDesde) : null,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  return { url: urlAutorizacion(datos.proveedor, state, verifier) };
}
