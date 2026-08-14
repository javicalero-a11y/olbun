import type { Metadata } from 'next';
import Link from 'next/link';

import { requirePermission } from '@/lib/auth/guardias';
import { can } from '@/lib/auth/can';
import { tenantClient } from '@/lib/db/tenant';
import { serverEnv } from '@/lib/env';
import { analizarComunicacionAccion } from '../detecciones/acciones';
import { BotonAnalizar } from '@/components/features/detecciones/boton-analizar';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { FormularioSubida } from '@/components/features/comunicaciones/formulario-subida';
import { PanelAlias } from '@/components/features/comunicaciones/panel-alias';
import { PanelBuzones } from '@/components/features/comunicaciones/panel-buzones';
import { PanelLotes } from '@/components/features/comunicaciones/panel-lotes';
import { proveedorCorreoConfigurado } from '@/lib/services/buzones/oauth';
import { crearAliasReenvio, subirComunicacion } from './acciones';
import {
  crearLote,
  desconectar,
  iniciarConexionBuzon,
  recogerLote,
  sincronizar,
} from './buzones-acciones';

export const metadata: Metadata = { title: 'Comunicaciones' };

const ETIQUETA_REVISION: Record<string, { texto: string; clase: string }> = {
  SIN_REVISAR: { texto: 'Sin revisar', clase: 'text-status-amber' },
  REVISADA: { texto: 'Revisada', clase: 'text-status-green' },
  ARCHIVADA: { texto: 'Archivada', clase: 'text-muted-foreground' },
};

function fechaCorta(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

function mensajeOAuth(estado: string | undefined): string | undefined {
  if (!estado) return undefined;
  const mensajes: Record<string, string> = {
    conectado: 'Buzón conectado. Pulsa “Sincronizar” para realizar la primera carga.',
    cancelado: 'La conexión se canceló sin dar acceso al buzón.',
    caducado: 'La solicitud caducó o ya se utilizó. Inicia una conexión nueva.',
    'usuario-incorrecto': 'La conexión debe terminarla la misma persona que la inició.',
    'garantias-incompletas':
      'El buzón personal ya no tiene completas las garantías requeridas para conectarlo.',
    error:
      'El proveedor no pudo completar la conexión. Revisa la configuración e inténtalo otra vez.',
  };
  return mensajes[estado] ?? 'No se ha podido iniciar la conexión del buzón.';
}

/**
 * The inbox.
 *
 * Unreviewed first, then newest: the question this screen answers is "what has
 * arrived that nobody has looked at", not "what arrived most recently".
 */
export default async function ComunicacionesPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ oauth?: string }>;
}) {
  const { orgSlug } = await params;
  const { oauth } = await searchParams;
  const contexto = await requirePermission(orgSlug, 'comunicacion:view');
  const db = tenantClient(contexto.organisation.id);

  const puedeGestionarBuzones = can(contexto.actor, 'buzon:manage');
  const puedeRevisarDetecciones = can(contexto.actor, 'deteccion:review');
  const [comunicaciones, contratos, aliases, buzonesOAuth, documentosPolitica, lotes] =
    await Promise.all([
      db.comunicacion.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          asunto: true,
          de: true,
          fechaRecepcion: true,
          direccion: true,
          estadoRevision: true,
          contrato: { select: { numeroExpediente: true } },
          _count: { select: { adjuntos: true, detecciones: true } },
        },
        orderBy: [{ estadoRevision: 'asc' }, { fechaRecepcion: 'desc' }],
        take: 200,
      }),
      db.contrato.findMany({
        where: { deletedAt: null },
        select: { id: true, numeroExpediente: true, objeto: true },
        orderBy: { numeroExpediente: 'asc' },
      }),
      puedeGestionarBuzones
        ? db.buzonConectado.findMany({
            where: { tipo: 'ALIAS_REENVIO', deletedAt: null },
            select: {
              id: true,
              direccion: true,
              contrato: { select: { numeroExpediente: true } },
            },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      puedeGestionarBuzones
        ? db.buzonConectado.findMany({
            where: {
              tipo: { in: ['GOOGLE_FUNCIONAL', 'MS365_FUNCIONAL'] },
              deletedAt: null,
            },
            select: {
              id: true,
              tipo: true,
              direccion: true,
              estadoOAuth: true,
              ultimaSincronizacion: true,
              errorSincronizacion: true,
              esPersonal: true,
              activo: true,
              _count: {
                select: {
                  comunicaciones: {
                    where: {
                      deletedAt: null,
                      detecciones: { none: { deletedAt: null } },
                      itemsLoteDeteccion: { none: {} },
                    },
                  },
                },
              },
            },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      puedeGestionarBuzones
        ? db.documento.findMany({
            where: { deletedAt: null },
            select: { id: true, nombre: true },
            orderBy: { nombre: 'asc' },
            take: 200,
          })
        : Promise.resolve([]),
      puedeRevisarDetecciones
        ? db.loteDeteccion.findMany({
            select: {
              id: true,
              estado: true,
              total: true,
              completados: true,
              fallidos: true,
              createdAt: true,
              buzon: { select: { direccion: true, nombre: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

  const accion = subirComunicacion.bind(null, orgSlug);
  const accionAnalizar = analizarComunicacionAccion.bind(null, orgSlug);
  const accionAlias = crearAliasReenvio.bind(null, orgSlug);
  const accionIniciarBuzon = iniciarConexionBuzon.bind(null, orgSlug);
  const accionSincronizar = sincronizar.bind(null, orgSlug);
  const accionDesconectar = desconectar.bind(null, orgSlug);
  const accionCrearLote = crearLote.bind(null, orgSlug);
  const accionRecogerLote = recogerLote.bind(null, orgSlug);
  const opcionesContrato = contratos.map((contrato) => ({
    id: contrato.id,
    etiqueta: `${contrato.numeroExpediente} — ${contrato.objeto}`,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comunicaciones</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          La correspondencia del contrato, en un sitio y sin duplicados. Carga exportaciones de
          correo, usa un alias o conecta un buzón funcional de Google o Microsoft.
        </p>
      </div>

      <FormularioSubida accion={accion} contratos={opcionesContrato} />

      {puedeGestionarBuzones ? (
        <PanelBuzones
          iniciar={accionIniciarBuzon}
          sincronizar={accionSincronizar}
          desconectar={accionDesconectar}
          buzones={buzonesOAuth.flatMap((buzon) =>
            buzon.direccion
              ? [
                  {
                    id: buzon.id,
                    proveedor:
                      buzon.tipo === 'GOOGLE_FUNCIONAL'
                        ? ('Google Workspace' as const)
                        : ('Microsoft 365' as const),
                    direccion: buzon.direccion,
                    estado: buzon.estadoOAuth ?? 'Sin configurar',
                    ultimaSincronizacion: buzon.ultimaSincronizacion
                      ? fechaCorta(buzon.ultimaSincronizacion)
                      : null,
                    error: buzon.errorSincronizacion,
                    personal: buzon.esPersonal,
                    activo: buzon.activo,
                  },
                ]
              : [],
          )}
          contratos={opcionesContrato}
          documentos={documentosPolitica.map((documento) => ({
            id: documento.id,
            etiqueta: documento.nombre,
          }))}
          googleConfigurado={proveedorCorreoConfigurado('GOOGLE')}
          microsoftConfigurado={proveedorCorreoConfigurado('MICROSOFT')}
          avisoOAuth={mensajeOAuth(oauth)}
        />
      ) : null}

      {puedeRevisarDetecciones ? (
        <PanelLotes
          crear={accionCrearLote}
          recoger={accionRecogerLote}
          disponible={Boolean(serverEnv().ANTHROPIC_API_KEY)}
          pendientes={buzonesOAuth.flatMap((buzon) =>
            buzon.activo && buzon.direccion && buzon._count.comunicaciones > 0
              ? [
                  {
                    id: buzon.id,
                    direccion: buzon.direccion,
                    cantidad: buzon._count.comunicaciones,
                  },
                ]
              : [],
          )}
          lotes={lotes.map((lote) => ({
            id: lote.id,
            buzon: lote.buzon.direccion ?? lote.buzon.nombre,
            estado: lote.estado,
            total: lote.total,
            completados: lote.completados,
            fallidos: lote.fallidos,
            fecha: fechaCorta(lote.createdAt),
          }))}
        />
      ) : null}

      {puedeGestionarBuzones ? (
        <PanelAlias
          accion={accionAlias}
          aliases={aliases.flatMap((alias) =>
            alias.direccion
              ? [
                  {
                    id: alias.id,
                    direccion: alias.direccion,
                    contrato: alias.contrato?.numeroExpediente ?? null,
                  },
                ]
              : [],
          )}
          contratos={opcionesContrato}
          operativo={Boolean(serverEnv().INBOUND_EMAIL_SECRET)}
        />
      ) : null}

      <Tabla
        titulo="Correspondencia recibida, primero lo que nadie ha revisado"
        anchoMinimo="760px"
        filas={comunicaciones}
        claveDeFila={(comunicacion) => comunicacion.id}
        vacio={
          <EstadoVacio
            titulo="Aquí vivirá la correspondencia"
            explicacion="Los requerimientos, las quejas y los avisos de penalidad llegan por correo, y es donde primero aparece un problema. Reunirlos aquí es lo que permitirá detectarlos antes de que se conviertan en un expediente."
          />
        }
        columnas={[
          {
            clave: 'asunto',
            encabezado: 'Asunto',
            esCabeceraDeFila: true,
            celda: (comunicacion) => (
              <>
                <span className="text-sm font-medium">{comunicacion.asunto}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {comunicacion.direccion === 'ENTRANTE' ? 'De' : 'Para'} {comunicacion.de}
                  {comunicacion._count.adjuntos > 0
                    ? ` · ${String(comunicacion._count.adjuntos)} archivo${
                        comunicacion._count.adjuntos === 1 ? '' : 's'
                      } conservado${comunicacion._count.adjuntos === 1 ? '' : 's'}`
                    : ''}
                </p>
              </>
            ),
          },
          {
            clave: 'contrato',
            encabezado: 'Contrato',
            clase: 'text-xs text-muted-foreground',
            celda: (comunicacion) => comunicacion.contrato?.numeroExpediente ?? 'Sin vincular',
          },
          {
            clave: 'estado',
            encabezado: 'Estado',
            celda: (comunicacion) => {
              const estado = ETIQUETA_REVISION[comunicacion.estadoRevision];
              return (
                <span className={`text-xs font-medium ${estado?.clase ?? ''}`}>
                  {estado?.texto ?? comunicacion.estadoRevision}
                </span>
              );
            },
          },
          {
            clave: 'fecha',
            encabezado: 'Fecha',
            numerica: true,
            clase: 'text-xs whitespace-nowrap',
            celda: (comunicacion) => fechaCorta(comunicacion.fechaRecepcion),
          },
          {
            clave: 'deteccion',
            encabezado: 'Detección',
            clase: 'whitespace-nowrap',
            celda: (comunicacion) => (
              <div className="flex items-center gap-2">
                <BotonAnalizar comunicacionId={comunicacion.id} accion={accionAnalizar} />
                {comunicacion._count.detecciones > 0 ? (
                  <Link
                    href={`/${orgSlug}/detecciones`}
                    className="text-xs underline underline-offset-4"
                  >
                    {String(comunicacion._count.detecciones)}
                  </Link>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        <Link href={`/${orgSlug}/contratos`} className="underline underline-offset-4">
          Ver contratos
        </Link>
      </p>
    </div>
  );
}
