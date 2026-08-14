import { NextResponse } from 'next/server';

import { registrarEvento } from '@/lib/audit/registrar';
import { requirePermission } from '@/lib/auth/guardias';
import { cifrar, descifrar } from '@/lib/crypto/cifrado';
import { resolverSolicitudOAuth } from '@/lib/db/oauth-buzon';
import { tenantTransaction } from '@/lib/db/tenant';
import { validarGarantiasBuzon } from '@/lib/domain/buzones/conexion';
import { serverEnv } from '@/lib/env';
import { hashOAuth, identidadBuzon, intercambiarCodigo } from '@/lib/services/buzones/oauth';
import type { ProveedorCorreo } from '@/lib/services/buzones/oauth';

function proveedorValido(valor: string): ProveedorCorreo | undefined {
  if (valor === 'google') return 'GOOGLE';
  if (valor === 'microsoft') return 'MICROSOFT';
  return undefined;
}

function volver(slug: string, estado: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/${slug}/comunicaciones?oauth=${estado}`, serverEnv().APP_URL),
  );
}

export async function GET(
  peticion: Request,
  { params }: { params: Promise<{ proveedor: string }> },
): Promise<NextResponse> {
  const { proveedor: nombreProveedor } = await params;
  const proveedor = proveedorValido(nombreProveedor);
  if (!proveedor)
    return NextResponse.json({ error: 'Proveedor desconocido.' }, { status: 404 });

  const url = new URL(peticion.url);
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state) return NextResponse.json({ error: 'Falta el estado OAuth.' }, { status: 400 });

  const solicitud = await resolverSolicitudOAuth(hashOAuth(state));
  if (!solicitud)
    return NextResponse.json({ error: 'Conexión no disponible.' }, { status: 404 });

  const slug = solicitud.organisation.slug;
  if (url.searchParams.has('error') || !code) return volver(slug, 'cancelado');
  if (
    solicitud.proveedor !== proveedor ||
    solicitud.consumedAt ||
    solicitud.expiresAt.getTime() <= Date.now()
  ) {
    return volver(slug, 'caducado');
  }

  const sesion = await requirePermission(slug, 'buzon:manage');
  if (sesion.user.id !== solicitud.solicitadoPorId) return volver(slug, 'usuario-incorrecto');
  if (
    !validarGarantiasBuzon({
      esPersonal: solicitud.esPersonal,
      politicaInternaDocumentoId: solicitud.politicaInternaDocumentoId,
      consultaRepresentacionFecha: solicitud.consultaRepresentacionFecha
        ?.toISOString()
        .slice(0, 10),
    }).permitida
  ) {
    return volver(slug, 'garantias-incompletas');
  }

  try {
    const credencial = await intercambiarCodigo(
      proveedor,
      code,
      descifrar(solicitud.pkceVerifierCifrado),
    );
    const identidad = await identidadBuzon(proveedor, credencial.accessToken);

    await tenantTransaction(solicitud.organisationId, async (tx) => {
      const consumida = await tx.solicitudOAuthBuzon.updateMany({
        where: { id: solicitud.id, consumedAt: null, expiresAt: { gt: new Date() } },
        data: { consumedAt: new Date() },
      });
      if (consumida.count !== 1) throw new Error('La conexión ya se utilizó o caducó.');

      if (solicitud.esPersonal && solicitud.politicaInternaDocumentoId) {
        const politica = await tx.documento.findFirst({
          where: { id: solicitud.politicaInternaDocumentoId, deletedAt: null },
          select: { id: true },
        });
        if (!politica) throw new Error('La política interna ya no está disponible.');
      }

      const existente = await tx.buzonConectado.findFirst({
        where: { direccion: identidad.direccion, deletedAt: null },
        select: { id: true },
      });
      const datos = {
        tipo:
          proveedor === 'GOOGLE' ? ('GOOGLE_FUNCIONAL' as const) : ('MS365_FUNCIONAL' as const),
        nombre: identidad.direccion,
        direccion: identidad.direccion,
        contratoId: solicitud.contratoId,
        estadoOAuth: 'ACTIVO' as const,
        proveedorCuentaId: identidad.cuentaId,
        tokenAccesoCifrado: cifrar(credencial.accessToken),
        tokenRefrescoCifrado: cifrar(credencial.refreshToken ?? ''),
        tokenExpiraEn: credencial.expiraEn,
        scopesOAuth: credencial.scopes,
        cursorSincronizacion: null,
        historicoDesde: solicitud.historicoDesde,
        errorSincronizacion: null,
        esPersonal: solicitud.esPersonal,
        politicaInternaDocumentoId: solicitud.politicaInternaDocumentoId,
        consultaRepresentacionFecha: solicitud.consultaRepresentacionFecha,
        activo: true,
        deletedAt: null,
      };

      const buzon = existente
        ? await tx.buzonConectado.update({ where: { id: existente.id }, data: datos })
        : await tx.buzonConectado.create({
            data: {
              organisationId: solicitud.organisationId,
              createdById: sesion.user.id,
              ...datos,
            },
          });

      await registrarEvento(
        tx,
        {
          organisationId: solicitud.organisationId,
          actorId: sesion.user.id,
          actorEmail: sesion.user.email,
          actorRol: sesion.actor.role,
        },
        {
          tipo: existente ? 'MODIFICACION' : 'CREACION',
          accion: existente ? 'buzon.reconectar' : 'buzon.conectar',
          entidad: 'BuzonConectado',
          entidadId: buzon.id,
          descripcion: identidad.direccion,
          despues: {
            proveedor,
            direccion: identidad.direccion,
            esPersonal: solicitud.esPersonal,
            scopes: credencial.scopes,
          },
        },
      );
    });
    return volver(slug, 'conectado');
  } catch {
    return volver(slug, 'error');
  }
}
