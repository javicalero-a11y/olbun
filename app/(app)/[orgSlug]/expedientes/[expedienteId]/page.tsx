import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { avisosDePlazos, type PlazoEvaluable } from '@/lib/domain/expedientes/avisos';
import { construirCronograma, type HitoCronograma } from '@/lib/domain/expedientes/cronograma';
import {
  describirComputo,
  ETIQUETA_ESTADO_EXPEDIENTE,
  ETIQUETA_JURISDICCION,
  ETIQUETA_PROBABILIDAD,
  ETIQUETA_TIPO_EXPEDIENTE,
} from '@/lib/domain/expedientes/etiquetas';
import { formatearEuros } from '@/lib/domain/contratos/etiquetas';
import { formatearEs, hoyEn, type FechaCivil } from '@/lib/domain/fecha';
import { PanelPlazos } from '@/components/features/expedientes/aviso-plazo';
import { VistaCronograma } from '@/components/features/expedientes/cronograma';

export const metadata: Metadata = { title: 'Expediente' };

function aCivil(valor: Date): FechaCivil;
function aCivil(valor: Date | null): FechaCivil | undefined;
function aCivil(valor: Date | null): FechaCivil | undefined {
  return valor ? valor.toISOString().slice(0, 10) : undefined;
}

export default async function ExpedientePage({
  params,
}: {
  params: Promise<{ orgSlug: string; expedienteId: string }>;
}) {
  const { orgSlug, expedienteId } = await params;
  const contexto = await requirePermission(orgSlug, 'expediente:view');
  const db = tenantClient(contexto.organisation.id);

  const expediente = await db.expediente.findFirst({
    where: { id: expedienteId, deletedAt: null },
    include: {
      contrato: {
        select: { id: true, numeroExpediente: true, objeto: true },
      },
      plantilla: { select: { nombre: true } },
      hitos: {
        where: { deletedAt: null },
        orderBy: { orden: 'asc' },
        include: { plazo: true },
      },
      plazos: { where: { deletedAt: null } },
      actuaciones: { where: { deletedAt: null }, orderBy: { fecha: 'desc' } },
    },
  });

  if (!expediente) notFound();

  const hoy = hoyEn(contexto.organisation.timezone);

  const plazosEvaluables: PlazoEvaluable[] = expediente.plazos.map((plazo) => ({
    id: plazo.id,
    descripcion: plazo.descripcion,
    fundamento: plazo.fundamento,
    cantidad: plazo.cantidad,
    computo: plazo.computo,
    fechaInicio: aCivil(plazo.fechaInicio),
    fechaVencimientoCalculada: aCivil(plazo.fechaVencimientoCalculada),
    fechaVencimientoConfirmada: aCivil(plazo.fechaVencimientoConfirmada),
    esPreclusivo: plazo.esPreclusivo,
    calculoCompleto: plazo.calculoCompleto,
    advertencias: plazo.advertencias,
    estado: plazo.estado,
  }));

  const avisos = avisosDePlazos(plazosEvaluables, hoy);

  const hitosCronograma: HitoCronograma[] = expediente.hitos.map((hito) => ({
    id: hito.id,
    orden: hito.orden,
    nombre: hito.nombre,
    tipo: hito.tipo,
    estado: hito.estado,
    fechaPrevista: aCivil(hito.fechaPrevista),
    fechaReal: aCivil(hito.fechaReal),
    plazo: hito.plazo
      ? {
          id: hito.plazo.id,
          fechaInicio: aCivil(hito.plazo.fechaInicio),
          vencimiento:
            aCivil(hito.plazo.fechaVencimientoConfirmada) ??
            aCivil(hito.plazo.fechaVencimientoCalculada),
          esPreclusivo: hito.plazo.esPreclusivo,
          calculoCompleto: hito.plazo.calculoCompleto,
          fundamento: hito.plazo.fundamento,
        }
      : undefined,
  }));

  const cronograma = construirCronograma(hitosCronograma, hoy);
  const sinFecha = expediente.hitos.filter(
    (h) => h.fechaPrevista === null && h.fechaReal === null && h.plazo === null,
  );

  const hayCalculosIncompletos = expediente.plazos.some((p) => !p.calculoCompleto);
  const estado = ETIQUETA_ESTADO_EXPEDIENTE[expediente.estado];

  return (
    <div className="space-y-10">
      <div>
        <Link
          href={`/${orgSlug}/expedientes`}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Expedientes
        </Link>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground" data-numeric>
              {expediente.referencia}
            </p>
            <h1 className="mt-0.5 max-w-2xl text-2xl font-semibold tracking-tight">
              {expediente.titulo}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ETIQUETA_TIPO_EXPEDIENTE[expediente.tipo] ?? expediente.tipo} ·{' '}
              {ETIQUETA_JURISDICCION[expediente.jurisdiccion] ?? expediente.jurisdiccion}
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className={`text-sm font-medium ${estado?.clase ?? ''}`}>
              {estado?.texto ?? expediente.estado}
            </span>

            {/* The whole file in one zip, for external counsel or an
                inspection. Gated on expediente:export, and audited. */}
            <a
              href={`/api/expedientes/${expediente.id}/zip?org=${orgSlug}`}
              className="rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Descargar expediente
            </a>
          </div>
        </div>
      </div>

      {hayCalculosIncompletos ? (
        <div className="rounded-md border border-status-amber/30 bg-status-amber-subtle px-4 py-3">
          <p className="text-sm font-medium text-status-amber">
            <span aria-hidden="true">▲ </span>
            Hay plazos calculados sobre calendarios sin verificar
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Las fechas de abajo son una ayuda, no una fecha firme. Compruébalas contra la
            notificación antes de actuar. Los calendarios se marcan como verificados desde
            Ajustes, una vez cotejados con su fuente oficial.
          </p>
        </div>
      ) : null}

      {expediente.resumen ? (
        <p className="max-w-2xl text-sm leading-relaxed">{expediente.resumen}</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Plazos</h2>
        <PanelPlazos avisos={avisos} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Cronograma</h2>
        {cronograma ? (
          <VistaCronograma cronograma={cronograma} />
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
            Ningún hito tiene fecha todavía.
          </p>
        )}

        {sinFecha.length > 0 ? (
          <div className="rounded-md border border-border px-3 py-2.5">
            <p className="text-xs font-medium">Hitos sin fecha</p>
            <ul className="mt-1 space-y-0.5">
              {sinFecha.map((hito) => (
                <li key={hito.id} className="text-xs text-muted-foreground">
                  {hito.nombre}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Datos</h2>
          <dl className="space-y-2 text-sm">
            <Dato termino="Apertura" valor={formatearEs(aCivil(expediente.fechaApertura))} />
            <Dato termino="Órgano competente" valor={expediente.organoCompetente} />
            <Dato termino="Parte contraria" valor={expediente.parteContraria} />
            <Dato
              termino="Cuantía"
              valor={
                expediente.cuantiaIndeterminada
                  ? 'Indeterminada'
                  : formatearEuros(expediente.cuantia ? Number(expediente.cuantia) : null)
              }
            />
            <Dato
              termino="Provisión contable"
              valor={formatearEuros(
                expediente.provisionContable ? Number(expediente.provisionContable) : null,
              )}
            />
            <Dato
              termino="Probabilidad de éxito"
              valor={
                expediente.probabilidadExito
                  ? (ETIQUETA_PROBABILIDAD[expediente.probabilidadExito] ??
                    expediente.probabilidadExito)
                  : null
              }
            />
            <Dato termino="Despacho externo" valor={expediente.despachoExterno} />
            <Dato termino="Número de autos" valor={expediente.numeroAutos} />
            <Dato termino="Plantilla" valor={expediente.plantilla?.nombre} />
            {expediente.contrato ? (
              <div className="flex gap-3">
                <dt className="w-40 shrink-0 text-xs text-muted-foreground">Contrato</dt>
                <dd className="text-xs">
                  <Link
                    href={`/${orgSlug}/contratos/${expediente.contrato.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {expediente.contrato.numeroExpediente}
                  </Link>
                  <span className="block text-muted-foreground">
                    {expediente.contrato.objeto}
                  </span>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Cómo se han calculado</h2>
          {expediente.plazos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay plazos calculados.</p>
          ) : (
            <ul className="space-y-3">
              {expediente.plazos.map((plazo) => (
                <li key={plazo.id} className="rounded-md border border-border px-3 py-2.5">
                  <p className="text-xs font-medium">{plazo.descripcion}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {describirComputo(plazo.cantidad, plazo.computo)} desde el{' '}
                    {formatearEs(aCivil(plazo.fechaInicio))} ·{' '}
                    <span data-numeric>
                      vence el {formatearEs(aCivil(plazo.fechaVencimientoCalculada))}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{plazo.fundamento}</p>
                  {plazo.advertencias.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {plazo.advertencias.map((advertencia) => (
                        <li key={advertencia} className="text-xs text-status-amber">
                          <span aria-hidden="true">▲ </span>
                          {advertencia}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-tight">Actuaciones</h2>
        {expediente.actuaciones.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no se ha registrado ninguna.</p>
        ) : (
          <ul className="space-y-2">
            {expediente.actuaciones.map((actuacion) => (
              <li key={actuacion.id} className="border-b border-border pb-2 last:border-0">
                <p className="text-xs text-muted-foreground" data-numeric>
                  {formatearEs(aCivil(actuacion.fecha))}
                </p>
                <p className="mt-0.5 text-sm">{actuacion.descripcion}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dato({ termino, valor }: { termino: string; valor?: string | null }) {
  if (!valor) return null;

  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 text-xs text-muted-foreground">{termino}</dt>
      <dd className="text-xs">{valor}</dd>
    </div>
  );
}
