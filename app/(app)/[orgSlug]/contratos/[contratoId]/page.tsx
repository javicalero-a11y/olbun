import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { avisosDeContrato } from '@/lib/domain/contratos/avisos';
import {
  ETIQUETA_ESTADO_CONTRATO,
  ETIQUETA_PROCEDIMIENTO,
  ETIQUETA_TIPO_CONTRATO,
  ETIQUETA_TIPO_PODER,
  formatearEuros,
} from '@/lib/domain/contratos/etiquetas';
import { formatearEs, hoyEn, type FechaCivil } from '@/lib/domain/fecha';
import { PanelAvisos } from '@/components/features/contratos/aviso';

export const metadata: Metadata = { title: 'Contrato' };

function aCivil(valor: Date | null): FechaCivil | undefined {
  return valor ? valor.toISOString().slice(0, 10) : undefined;
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 text-sm">{valor}</dd>
    </div>
  );
}

export default async function ContratoPage({
  params,
}: {
  params: Promise<{ orgSlug: string; contratoId: string }>;
}) {
  const { orgSlug, contratoId } = await params;
  const contexto = await requirePermission(orgSlug, 'contrato:view');
  const db = tenantClient(contexto.organisation.id);

  const contrato = await db.contrato.findFirst({
    where: { id: contratoId, deletedAt: null },
    include: { poderAdjudicador: true },
  });

  // Another tenant's contract and a non-existent one are the same answer.
  if (!contrato) notFound();

  const hoy = hoyEn(contexto.organisation.timezone);
  const fin = aCivil(contrato.fechaFinPrevista);
  const avisos = avisosDeContrato(
    {
      fechaFinPrevista: fin,
      preavisoProrrogaDias: contrato.preavisoProrrogaDias ?? undefined,
      estado: contrato.estado,
    },
    hoy,
  );
  const estado = ETIQUETA_ESTADO_CONTRATO[contrato.estado];

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/${orgSlug}/contratos`}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          ← Contratos
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight" data-numeric>
            {contrato.numeroExpediente}
          </h1>
          <span className={`text-sm font-medium ${estado.clase}`}>{estado.texto}</span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{contrato.objeto}</p>
      </div>

      {avisos.length > 0 ? (
        <section aria-labelledby="avisos" className="space-y-3">
          <h2 id="avisos" className="text-sm font-semibold">
            Qué vence
          </h2>
          <PanelAvisos avisos={avisos} />
        </section>
      ) : null}

      <section aria-labelledby="organo" className="space-y-3">
        <h2 id="organo" className="text-sm font-semibold">
          Órgano de contratación
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Nombre" valor={contrato.poderAdjudicador.nombre} />
          <Dato etiqueta="Tipo" valor={ETIQUETA_TIPO_PODER[contrato.poderAdjudicador.tipo]} />
          <Dato etiqueta="Municipio" valor={contrato.poderAdjudicador.municipioNombre ?? '—'} />
        </dl>
      </section>

      <section aria-labelledby="ficha" className="space-y-3">
        <h2 id="ficha" className="text-sm font-semibold">
          Ficha
        </h2>
        <dl className="grid gap-4 sm:grid-cols-3">
          <Dato etiqueta="Tipo" valor={ETIQUETA_TIPO_CONTRATO[contrato.tipo]} />
          <Dato
            etiqueta="Procedimiento"
            valor={ETIQUETA_PROCEDIMIENTO[contrato.procedimiento]}
          />
          <Dato etiqueta="Lote" valor={contrato.lote ?? '—'} />
          <Dato
            etiqueta="Formalización"
            valor={
              aCivil(contrato.fechaFormalizacion)
                ? formatearEs(aCivil(contrato.fechaFormalizacion)!)
                : '—'
            }
          />
          <Dato
            etiqueta="Inicio"
            valor={
              aCivil(contrato.fechaInicio) ? formatearEs(aCivil(contrato.fechaInicio)!) : '—'
            }
          />
          <Dato etiqueta="Fin previsto" valor={fin ? formatearEs(fin) : '—'} />
          <Dato
            etiqueta="Importe de adjudicación"
            valor={formatearEuros(
              contrato.importeAdjudicacion ? Number(contrato.importeAdjudicacion) : null,
            )}
          />
          <Dato
            etiqueta="Preaviso de prórroga"
            valor={
              contrato.preavisoProrrogaDias
                ? `${String(contrato.preavisoProrrogaDias)} días`
                : '—'
            }
          />
          <Dato
            etiqueta="Garantía"
            valor={
              contrato.plazoGarantiaMeses ? `${String(contrato.plazoGarantiaMeses)} meses` : '—'
            }
          />
        </dl>

        {contrato.haySubrogacionPersonal ? (
          <p className="rounded-md border border-status-amber/30 bg-status-amber-subtle px-3 py-2 text-xs text-status-amber">
            ■ Con subrogación de personal. La plantilla de la empresa saliente se asume con su
            antigüedad y condiciones; es la principal fuente de litigio laboral del sector.
          </p>
        ) : null}
      </section>
    </div>
  );
}
