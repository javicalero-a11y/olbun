import 'server-only';

import type { Role } from '@prisma/client';

import { registrarEvento } from '@/lib/audit/registrar';
import { cifrar } from '@/lib/crypto/cifrado';
import { validarGarantiasBuzon } from '@/lib/domain/buzones/conexion';
import { tenantClient, tenantTransaction } from '@/lib/db/tenant';
import { serverEnv } from '@/lib/env';
import {
  analizarArchivoComunicacion,
  guardarComunicacion,
} from '@/lib/services/comunicaciones';
import { analizarComunicacion } from '@/lib/services/detecciones';
import { motorDeReglas } from '@/lib/services/detecciones/reglas';
import { ErrorProveedorCorreo } from './oauth';
import { obtenerLoteRemoto } from './sincronizacion-remota';

interface ActorSincronizacion {
  id: string;
  email: string;
  role: Role;
}

export interface ResumenSincronizacion {
  recibidos: number;
  nuevos: number;
  duplicados: number;
  detecciones: number;
  pendientesBatch: number;
}

export async function sincronizarBuzon(
  organisationId: string,
  buzonId: string,
  actor: ActorSincronizacion,
): Promise<ResumenSincronizacion> {
  const db = tenantClient(organisationId);
  const buzon = await db.buzonConectado.findFirst({
    where: { id: buzonId, deletedAt: null, activo: true },
    select: {
      id: true,
      tipo: true,
      direccion: true,
      estadoOAuth: true,
      tokenAccesoCifrado: true,
      tokenRefrescoCifrado: true,
      tokenExpiraEn: true,
      scopesOAuth: true,
      cursorSincronizacion: true,
      historicoDesde: true,
      contratoId: true,
      esPersonal: true,
      politicaInternaDocumentoId: true,
      consultaRepresentacionFecha: true,
    },
  });

  if (!buzon || (buzon.tipo !== 'GOOGLE_FUNCIONAL' && buzon.tipo !== 'MS365_FUNCIONAL')) {
    throw new Error('El buzón conectado no existe.');
  }
  if (
    buzon.estadoOAuth !== 'ACTIVO' ||
    !buzon.direccion ||
    !buzon.tokenAccesoCifrado ||
    !buzon.tokenRefrescoCifrado ||
    !buzon.tokenExpiraEn
  ) {
    throw new Error('El buzón necesita volver a conectarse antes de sincronizar.');
  }
  const garantias = validarGarantiasBuzon({
    esPersonal: buzon.esPersonal,
    politicaInternaDocumentoId: buzon.politicaInternaDocumentoId,
    consultaRepresentacionFecha: buzon.consultaRepresentacionFecha?.toISOString().slice(0, 10),
  });
  if (!garantias.permitida) {
    throw new Error('El buzón personal no tiene completas sus garantías laborales.');
  }

  const reclamado = await tenantTransaction(organisationId, (tx) =>
    tx.buzonConectado.updateMany({
      where: {
        id: buzon.id,
        OR: [
          { sincronizandoDesde: null },
          { sincronizandoDesde: { lt: new Date(Date.now() - 15 * 60 * 1000) } },
        ],
      },
      data: { sincronizandoDesde: new Date(), errorSincronizacion: null },
    }),
  );
  if (reclamado.count !== 1) {
    throw new Error('Este buzón ya se está sincronizando.');
  }

  try {
    const lote = await obtenerLoteRemoto(
      {
        tipo: buzon.tipo,
        direccion: buzon.direccion,
        tokenAccesoCifrado: buzon.tokenAccesoCifrado,
        tokenRefrescoCifrado: buzon.tokenRefrescoCifrado,
        tokenExpiraEn: buzon.tokenExpiraEn,
        scopesOAuth: buzon.scopesOAuth,
        cursorSincronizacion: buzon.cursorSincronizacion,
      },
      buzon.historicoDesde,
    );

    const analizados = await Promise.all(
      lote.mensajes.map(async (mensaje) => ({
        direccion: mensaje.direccion,
        comunicacion: (
          await analizarArchivoComunicacion(mensaje.raw, {
            nombre: `${mensaje.remotoId}.eml`,
            mimeType: 'message/rfc822',
          })
        ).comunicacion,
      })),
    );
    const enviarHistoricoABatch = Boolean(
      buzon.historicoDesde && serverEnv().ANTHROPIC_API_KEY,
    );

    return await tenantTransaction(organisationId, async (tx) => {
      const resumen: ResumenSincronizacion = {
        recibidos: analizados.length,
        nuevos: 0,
        duplicados: 0,
        detecciones: 0,
        pendientesBatch: 0,
      };

      for (const mensaje of analizados) {
        const guardada = await guardarComunicacion(
          tx,
          organisationId,
          buzon.id,
          mensaje.comunicacion,
          { direccion: mensaje.direccion, contratoId: buzon.contratoId ?? undefined },
        );
        if (guardada.estado === 'DUPLICADA') {
          resumen.duplicados += 1;
          continue;
        }
        resumen.nuevos += 1;
        if (enviarHistoricoABatch) {
          resumen.pendientesBatch += 1;
          continue;
        }
        const deteccion = await analizarComunicacion(
          tx,
          organisationId,
          guardada.comunicacionId,
          motorDeReglas(),
        );
        resumen.detecciones += deteccion.creadas + deteccion.actualizadas;
      }

      await tx.buzonConectado.update({
        where: { id: buzon.id },
        data: {
          tokenAccesoCifrado: cifrar(lote.credencial.accessToken),
          tokenRefrescoCifrado: cifrar(lote.credencial.refreshToken ?? ''),
          tokenExpiraEn: lote.credencial.expiraEn,
          scopesOAuth: lote.credencial.scopes,
          cursorSincronizacion: lote.cursor,
          // Keep the approved historical boundary until every provider page
          // has been consumed. Clearing it early would make the next page look
          // like live mail and could silently skip the remainder.
          historicoDesde: lote.historicoCompleto ? null : buzon.historicoDesde,
          ultimaSincronizacion: new Date(),
          sincronizandoDesde: null,
          errorSincronizacion: null,
          estadoOAuth: 'ACTIVO',
        },
      });

      await registrarEvento(
        tx,
        {
          organisationId,
          actorId: actor.id,
          actorEmail: actor.email,
          actorRol: actor.role,
        },
        {
          tipo: 'CREACION',
          accion: 'buzon.sincronizar',
          entidad: 'BuzonConectado',
          entidadId: buzon.id,
          descripcion: buzon.direccion ?? undefined,
          despues: { ...resumen },
        },
      );
      return resumen;
    });
  } catch (error) {
    const mensaje =
      error instanceof ErrorProveedorCorreo && error.requiereReconectar
        ? 'La autorización ha caducado o fue revocada. Vuelve a conectar el buzón.'
        : 'La sincronización no se ha podido completar. Inténtalo de nuevo.';
    await tenantTransaction(organisationId, (tx) =>
      tx.buzonConectado.update({
        where: { id: buzon.id },
        data: {
          sincronizandoDesde: null,
          errorSincronizacion: mensaje,
          estadoOAuth:
            error instanceof ErrorProveedorCorreo && error.requiereReconectar
              ? 'REQUIERE_ATENCION'
              : 'ACTIVO',
        },
      }),
    );
    throw new Error(mensaje);
  }
}
