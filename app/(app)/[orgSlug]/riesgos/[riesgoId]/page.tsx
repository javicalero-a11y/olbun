import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { actualizarCorrectora, crearControl, crearCorrectora, revisar } from '../acciones';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { AccionesCorrectoras } from '@/components/features/riesgos/acciones-correctoras';
import { FormularioControlRiesgo } from '@/components/features/riesgos/formulario-control';
import { FormularioRevisionRiesgo } from '@/components/features/riesgos/formulario-revision';
import { CLASE_NIVEL } from '@/components/features/riesgos/formulario-riesgo';
import { tenantClient } from '@/lib/db/tenant';
import { hoyEn, sumarDias, type FechaCivil } from '@/lib/domain/fecha';
import {
  bandasDesdeDesconocido,
  nombreDeNivel,
  reduccion,
  valorar,
  valorarResidual,
  type Escala,
} from '@/lib/domain/riesgos/matriz';
import { cargarBandasRiesgo } from '@/lib/services/riesgos';

export const metadata: Metadata = { title: 'Detalle del riesgo' };

const ETIQUETA_CONTROL: Record<string, string> = {
  PREVENTIVO: 'Preventivo',
  DETECTIVO: 'Detectivo',
  CORRECTIVO: 'Correctivo',
  DIRECTIVO: 'Directivo',
};
const ETIQUETA_EFICACIA: Record<string, string> = {
  NO_EVALUADO: 'No evaluado',
  INEFICAZ: 'Ineficaz',
  PARCIAL: 'Parcialmente eficaz',
  EFICAZ: 'Eficaz',
};
const ETIQUETA_RESULTADO: Record<string, string> = {
  SIN_CAMBIOS: 'Sin cambios',
  REVALORADO: 'Revalorado',
  CONTROL_ACTUALIZADO: 'Control actualizado',
  MATERIALIZADO: 'Materializado',
  CERRADO: 'Cerrado',
};

function civil(fecha: Date | null): FechaCivil | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

function fechaHora(fecha: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(fecha);
}

export default async function RiesgoDetallePage({
  params,
}: {
  params: Promise<{ orgSlug: string; riesgoId: string }>;
}) {
  const { orgSlug, riesgoId } = await params;
  const contexto = await requirePermission(orgSlug, 'riesgo:view');
  const db = tenantClient(contexto.organisation.id);
  const [riesgo, membresias, bandas] = await Promise.all([
    db.riesgo.findFirst({
      where: { id: riesgoId, deletedAt: null },
      include: {
        categoria: { select: { nombre: true } },
        contrato: { select: { id: true, numeroExpediente: true, objeto: true } },
        controlesEstructurados: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        valoraciones: { orderBy: { valoradaEn: 'desc' } },
        revisiones: { orderBy: { revisadaEn: 'desc' } },
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
    cargarBandasRiesgo(db),
  ]);
  if (!riesgo) notFound();
  const recurso = {
    organisationId: contexto.organisation.id,
    id: riesgo.id,
    contratoId: riesgo.contratoId,
  };
  if (!can(contexto.actor, 'riesgo:view', recurso)) notFound();

  const inherente = valorar(
    riesgo.probabilidadInherente as Escala,
    riesgo.impactoInherente as Escala,
    bandas,
  );
  const residual = valorarResidual(riesgo.probabilidadResidual, riesgo.impactoResidual, bandas);
  const puedeGestionar = can(contexto.actor, 'riesgo:manage', recurso);
  const personas = membresias.map(({ user }) => ({ id: user.id, nombre: user.name }));
  const nombres = new Map(personas.map((persona) => [persona.id, persona.nombre]));
  const proxima =
    civil(riesgo.proximaRevision) ??
    sumarDias(hoyEn(contexto.organisation.timezone), riesgo.frecuenciaRevisionDias);

  return (
    <div className="space-y-8">
      <header className="space-y-3 border-b border-border pb-5">
        <Link
          href={`/${orgSlug}/riesgos`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Registro de riesgos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-muted-foreground">{riesgo.referencia}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{riesgo.evento}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {riesgo.contrato
                ? `${riesgo.contrato.numeroExpediente} — ${riesgo.contrato.objeto}`
                : 'Riesgo de toda la organización'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Categoría: {riesgo.categoria?.nombre ?? 'Heredada sin catálogo'}
            </p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">
            {riesgo.estado.replaceAll('_', ' ')}
          </span>
        </div>
      </header>

      <section aria-labelledby="redaccion-titulo" className="grid gap-3 md:grid-cols-3">
        <h2 id="redaccion-titulo" className="sr-only">
          Causa, evento y consecuencia
        </h2>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Porque…</p>
          <p className="mt-1 text-sm">{riesgo.causa}</p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-medium text-muted-foreground">puede ocurrir que…</p>
          <p className="mt-1 text-sm font-medium">{riesgo.evento}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">
            con la consecuencia de que…
          </p>
          <p className="mt-1 text-sm">{riesgo.consecuencia}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Valoración actual">
        <TarjetaValoracion
          titulo="Inherente"
          texto={`${nombreDeNivel(inherente.nivel, bandas)} · ${inherente.puntuacion}`}
          clase={CLASE_NIVEL[inherente.nivel]}
          detalle={`P ${inherente.probabilidad} × I ${inherente.impacto}`}
        />
        <TarjetaValoracion
          titulo="Residual"
          texto={
            residual
              ? `${nombreDeNivel(residual.nivel, bandas)} · ${residual.puntuacion}`
              : 'Sin valorar'
          }
          clase={residual ? CLASE_NIVEL[residual.nivel] : 'text-muted-foreground'}
          detalle={
            residual
              ? `P ${residual.probabilidad} × I ${residual.impacto}`
              : 'No se presume que los controles reduzcan el riesgo'
          }
        />
        <TarjetaValoracion
          titulo="Reducción"
          texto={
            residual
              ? `${Math.round((reduccion(inherente, residual) ?? 0) * 100)} %`
              : 'Pendiente'
          }
          clase=""
          detalle={
            residual ? 'Diferencia frente al inherente' : 'Se calculará al valorar el residual'
          }
        />
      </section>

      <section className="space-y-3" aria-labelledby="controles-titulo">
        <div>
          <h2 id="controles-titulo" className="text-base font-semibold">
            Controles
          </h2>
          <p className="text-xs text-muted-foreground">
            {riesgo.controlesEstructurados.length} controles estructurados
          </p>
        </div>
        {riesgo.controles ? (
          <p className="rounded-md border border-status-amber/30 bg-status-amber/5 p-3 text-sm">
            <strong>Texto heredado:</strong> {riesgo.controles}
          </p>
        ) : null}
        {riesgo.controlesEstructurados.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {riesgo.controlesEstructurados.map((control) => (
              <li key={control.id} className="rounded-lg border border-border p-4">
                <div className="flex justify-between gap-2">
                  <h3 className="text-sm font-semibold">{control.titulo}</h3>
                  <span className="text-xs">{ETIQUETA_EFICACIA[control.eficacia]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ETIQUETA_CONTROL[control.tipo]} ·{' '}
                  {control.esExistente ? 'Existente' : 'Planificado'}
                </p>
                <p className="mt-2 text-sm">{control.descripcion}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {control.responsableId
                    ? (nombres.get(control.responsableId) ?? 'Responsable inactivo')
                    : 'Sin responsable'}
                  {control.proximaPrueba
                    ? ` · próxima prueba ${civil(control.proximaPrueba)}`
                    : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Todavía no hay controles evaluables.
          </p>
        )}
      </section>

      {puedeGestionar ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <FormularioRevisionRiesgo
            accion={revisar.bind(null, orgSlug)}
            riesgoId={riesgo.id}
            probabilidadInherente={inherente.probabilidad}
            impactoInherente={inherente.impacto}
            probabilidadResidual={residual?.probabilidad ?? null}
            impactoResidual={residual?.impacto ?? null}
            proximaRevision={proxima}
            bandas={bandas}
          />
          <FormularioControlRiesgo
            accion={crearControl.bind(null, orgSlug)}
            riesgoId={riesgo.id}
            responsables={personas}
          />
        </div>
      ) : null}

      <AccionesCorrectoras
        acciones={riesgo.acciones.map((accion) => ({
          id: accion.id,
          titulo: accion.titulo,
          descripcion: accion.descripcion,
          estado: accion.estado,
          prioridad: accion.prioridad,
          progreso: accion.progreso,
          fechaLimite: civil(accion.fechaLimite),
          responsable: accion.responsableId
            ? (nombres.get(accion.responsableId) ?? 'Responsable inactivo')
            : null,
          motivoBloqueo: accion.motivoBloqueo,
          eficacia: accion.eficacia,
        }))}
        origen={{ tipo: 'riesgo', id: riesgo.id }}
        responsables={personas}
        accionCrear={crearCorrectora.bind(null, orgSlug)}
        accionActualizar={actualizarCorrectora.bind(null, orgSlug)}
        editable={puedeGestionar}
      />

      <section className="grid gap-6 xl:grid-cols-2">
        <div>
          <h2 className="mb-3 text-base font-semibold">Histórico de valoraciones</h2>
          <ol className="space-y-3">
            {riesgo.valoraciones.map((valoracion) => {
              const bandasHistoricas = bandasDesdeDesconocido(valoracion.bandas);
              return (
                <li key={valoracion.id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between gap-2 text-xs">
                    <strong>{valoracion.tipo.toLowerCase()}</strong>
                    <time>{fechaHora(valoracion.valoradaEn)}</time>
                  </div>
                  <p className="mt-1 text-sm">
                    Inherente {valoracion.puntuacionInherente} (
                    {nombreDeNivel(valoracion.nivelInherente, bandasHistoricas)})
                    {valoracion.puntuacionResidual
                      ? ` → residual ${valoracion.puntuacionResidual} (${nombreDeNivel(
                          valoracion.nivelResidual ?? 'MUY_ALTO',
                          bandasHistoricas,
                        )})`
                      : ' · residual sin valorar'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {valoracion.justificacion}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
        <div>
          <h2 className="mb-3 text-base font-semibold">Revisiones</h2>
          {riesgo.revisiones.length ? (
            <ol className="space-y-3">
              {riesgo.revisiones.map((revision) => (
                <li key={revision.id} className="rounded-lg border border-border p-3">
                  <div className="flex justify-between gap-2 text-xs">
                    <strong>{ETIQUETA_RESULTADO[revision.resultado]}</strong>
                    <time>{fechaHora(revision.revisadaEn)}</time>
                  </div>
                  <p className="mt-1 text-sm">{revision.comentarios}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {revision.proximaRevision
                      ? `Siguiente: ${civil(revision.proximaRevision)}`
                      : 'Sin nueva revisión'}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Aún no se ha registrado una revisión periódica.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function TarjetaValoracion({
  titulo,
  texto,
  clase,
  detalle,
}: {
  titulo: string;
  texto: string;
  clase?: string;
  detalle: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">{titulo}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${clase ?? ''}`}>{texto}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
}
