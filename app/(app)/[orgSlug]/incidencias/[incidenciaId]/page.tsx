import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { actualizar, actualizarCorrectora, crearCorrectora } from '../acciones';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { AccionesCorrectoras } from '@/components/features/riesgos/acciones-correctoras';
import { FormularioInvestigacion } from '@/components/features/riesgos/formulario-investigacion';
import { tenantClient } from '@/lib/db/tenant';

export const metadata: Metadata = { title: 'Detalle de la incidencia' };

const ETIQUETA_TIPO: Record<string, string> = {
  FALLO_SERVICIO: 'Fallo del servicio',
  QUEJA_USUARIO: 'Queja de usuario',
  ACCIDENTE: 'Accidente con baja',
  INCIDENTE_SIN_BAJA: 'Incidente sin baja',
  DANO_MATERIAL: 'Daño material',
  AGRESION: 'Agresión',
  MEDIOAMBIENTAL: 'Medioambiental',
  VEHICULO: 'Vehículo',
  SEGURIDAD_DATOS: 'Seguridad de datos',
};

function fecha(fecha: Date | null): string | null {
  return fecha
    ? new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeZone: 'Europe/Madrid',
      }).format(fecha)
    : null;
}

export default async function IncidenciaDetallePage({
  params,
}: {
  params: Promise<{ orgSlug: string; incidenciaId: string }>;
}) {
  const { orgSlug, incidenciaId } = await params;
  const contexto = await requirePermission(orgSlug, 'incidencia:view');
  const db = tenantClient(contexto.organisation.id);
  const [incidencia, membresias] = await Promise.all([
    db.incidencia.findFirst({
      where: { id: incidenciaId, deletedAt: null },
      include: {
        contrato: { select: { id: true, numeroExpediente: true, objeto: true } },
        expediente: { select: { id: true, referencia: true, titulo: true } },
        riesgos: {
          where: { deletedAt: null },
          select: { id: true, referencia: true, evento: true },
        },
        acciones: {
          where: { deletedAt: null },
          orderBy: [{ estado: 'asc' }, { fechaLimite: 'asc' }],
        },
      },
    }),
    db.membership.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    }),
  ]);
  if (!incidencia) notFound();
  const recurso = {
    organisationId: contexto.organisation.id,
    id: incidencia.id,
    contratoId: incidencia.contratoId,
    expedienteId: incidencia.expedienteId,
  };
  if (!can(contexto.actor, 'incidencia:view', recurso)) notFound();
  const puedeGestionar = can(contexto.actor, 'incidencia:update', recurso);
  const personas = membresias.map(({ user }) => ({ id: user.id, nombre: user.name }));
  const nombres = new Map(personas.map((persona) => [persona.id, persona.nombre]));

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border pb-5">
        <Link
          href={`/${orgSlug}/incidencias`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Registro de incidencias
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{incidencia.referencia}</p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {ETIQUETA_TIPO[incidencia.tipo] ?? incidencia.tipo}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {incidencia.contrato
                ? `${incidencia.contrato.numeroExpediente} — ${incidencia.contrato.objeto}`
                : 'Sin contrato vinculado'}
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
            {incidencia.estado.replaceAll('_', ' ')} ·{' '}
            {incidencia.gravedad.replaceAll('_', ' ')}
          </span>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">Qué ocurrió</h2>
          <p className="mt-2 text-sm whitespace-pre-wrap">{incidencia.descripcion}</p>
          {incidencia.medidasInmediatas ? (
            <>
              <h3 className="mt-4 text-xs font-semibold text-muted-foreground">
                Medidas inmediatas
              </h3>
              <p className="mt-1 text-sm">{incidencia.medidasInmediatas}</p>
            </>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-4 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Fecha del hecho</dt>
            <dd>{fecha(incidencia.fechaHecho)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Registrada</dt>
            <dd>{fecha(incidencia.fechaComunicacion)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Lugar</dt>
            <dd>{incidencia.lugar ?? 'Sin indicar'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cierre</dt>
            <dd>{fecha(incidencia.fechaCierre) ?? 'Abierta'}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Comunicaciones y vínculos">
        <Tarjeta
          titulo="Órgano de contratación"
          valor={
            incidencia.comunicadaAlOrgano
              ? `Comunicado ${fecha(incidencia.fechaComunicacionOrgano) ?? ''}`
              : 'Pendiente o no aplicable'
          }
        />
        <Tarjeta
          titulo="Autoridad competente"
          valor={
            !incidencia.esNotificableAAutoridad
              ? 'No marcada como notificable'
              : incidencia.notificadaAAutoridad
                ? `Notificada · ${incidencia.referenciaAutoridad ?? 'sin referencia'}`
                : 'Notificación pendiente'
          }
        />
        <Tarjeta
          titulo="Expediente"
          valor={
            incidencia.expediente
              ? `${incidencia.expediente.referencia} — ${incidencia.expediente.titulo}`
              : 'Sin expediente'
          }
        />
      </section>

      {incidencia.causaRaiz || incidencia.leccionesAprendidas ? (
        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">Causa raíz</h2>
            <p className="mt-2 text-sm">{incidencia.causaRaiz ?? 'Pendiente'}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">Lecciones aprendidas</h2>
            <p className="mt-2 text-sm">{incidencia.leccionesAprendidas ?? 'Pendiente'}</p>
          </div>
        </section>
      ) : null}

      {puedeGestionar ? (
        <FormularioInvestigacion
          accion={actualizar.bind(null, orgSlug)}
          incidencia={{
            id: incidencia.id,
            estado: incidencia.estado,
            causaRaiz: incidencia.causaRaiz,
            leccionesAprendidas: incidencia.leccionesAprendidas,
            comunicadaAlOrgano: incidencia.comunicadaAlOrgano,
            esNotificableAAutoridad: incidencia.esNotificableAAutoridad,
            notificadaAAutoridad: incidencia.notificadaAAutoridad,
            referenciaAutoridad: incidencia.referenciaAutoridad,
          }}
        />
      ) : null}

      <AccionesCorrectoras
        acciones={incidencia.acciones.map((accion) => ({
          id: accion.id,
          titulo: accion.titulo,
          descripcion: accion.descripcion,
          estado: accion.estado,
          prioridad: accion.prioridad,
          progreso: accion.progreso,
          fechaLimite: fecha(accion.fechaLimite),
          responsable: accion.responsableId
            ? (nombres.get(accion.responsableId) ?? 'Responsable inactivo')
            : null,
          motivoBloqueo: accion.motivoBloqueo,
          eficacia: accion.eficacia,
        }))}
        origen={{ tipo: 'incidencia', id: incidencia.id }}
        responsables={personas}
        accionCrear={crearCorrectora.bind(null, orgSlug)}
        accionActualizar={actualizarCorrectora.bind(null, orgSlug)}
        editable={puedeGestionar}
      />

      {incidencia.riesgos.length ? (
        <section>
          <h2 className="mb-3 text-base font-semibold">Riesgos vinculados</h2>
          <ul className="space-y-2">
            {incidencia.riesgos.map((riesgo) => (
              <li key={riesgo.id}>
                <Link
                  href={`/${orgSlug}/riesgos/${riesgo.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {riesgo.referencia} — {riesgo.evento}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Tarjeta({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-sm font-medium">{valor}</p>
    </div>
  );
}
