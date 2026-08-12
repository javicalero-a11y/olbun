import type { Metadata } from 'next';
import Link from 'next/link';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import {
  ETIQUETA_ESTADO_CONTRATO,
  ETIQUETA_PROCEDIMIENTO,
  ETIQUETA_TIPO_CONTRATO,
} from '@/lib/domain/contratos/etiquetas';
import { ESTADOS_CONTRATO, PROCEDIMIENTOS, TIPOS_CONTRATO } from '@/lib/validation/contratos';
import { FormularioContrato } from '@/components/features/contratos/formulario-contrato';
import { crearContrato } from '../acciones';

export const metadata: Metadata = { title: 'Nuevo contrato' };

export default async function NuevoContratoPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'contrato:create');
  const db = tenantClient(contexto.organisation.id);

  const organos = await db.poderAdjudicador.findMany({
    where: { deletedAt: null },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });

  if (organos.length === 0) {
    return (
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Nuevo contrato</h1>
        <div className="rounded-lg border border-dashed border-border p-6">
          <h2 className="text-sm font-semibold">Antes hace falta un órgano de contratación</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Todo contrato cuelga del ayuntamiento, diputación o entidad que lo adjudicó. El
            municipio del órgano determina además qué calendario de festivos locales se aplica a
            los plazos de sus procedimientos.
          </p>
          <Link
            href={`/${orgSlug}/contratos/organos/nuevo`}
            className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-4"
          >
            Registrar un órgano
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link
          href={`/${orgSlug}/contratos`}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          ← Contratos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nuevo contrato</h1>
      </div>

      <FormularioContrato
        accion={crearContrato.bind(null, orgSlug)}
        organos={organos.map((o) => ({ valor: o.id, etiqueta: o.nombre }))}
        tipos={TIPOS_CONTRATO.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_CONTRATO[t] }))}
        procedimientos={PROCEDIMIENTOS.map((p) => ({
          valor: p,
          etiqueta: ETIQUETA_PROCEDIMIENTO[p],
        }))}
        estados={ESTADOS_CONTRATO.map((e) => ({
          valor: e,
          etiqueta: ETIQUETA_ESTADO_CONTRATO[e].texto,
        }))}
      />
    </div>
  );
}
