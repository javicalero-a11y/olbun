import type { Metadata } from 'next';
import Link from 'next/link';

import { requirePermission } from '@/lib/auth/guardias';
import { ETIQUETA_TIPO_PODER } from '@/lib/domain/contratos/etiquetas';
import { TIPOS_PODER } from '@/lib/validation/contratos';
import { FormularioOrgano } from '@/components/features/contratos/formulario-organo';
import { crearPoderAdjudicador } from '../../acciones';

export const metadata: Metadata = { title: 'Nuevo órgano de contratación' };

export default async function NuevoOrganoPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  await requirePermission(orgSlug, 'poder_adjudicador:manage');

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link
          href={`/${orgSlug}/contratos`}
          className="text-xs text-muted-foreground underline underline-offset-4"
        >
          ← Contratos
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Nuevo órgano de contratación
        </h1>
      </div>

      <FormularioOrgano
        accion={crearPoderAdjudicador.bind(null, orgSlug)}
        tipos={TIPOS_PODER.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO_PODER[t] }))}
        volverA={`/${orgSlug}/contratos/nuevo`}
      />
    </div>
  );
}
