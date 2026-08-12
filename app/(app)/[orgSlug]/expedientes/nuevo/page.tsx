import type { Metadata } from 'next';
import Link from 'next/link';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import {
  describirComputo,
  ETIQUETA_JURISDICCION,
  ETIQUETA_TIPO_EXPEDIENTE,
} from '@/lib/domain/expedientes/etiquetas';
import { hoyEn } from '@/lib/domain/fecha';
import { crearExpediente } from '@/app/(app)/[orgSlug]/expedientes/acciones';
import {
  FormularioExpediente,
  type PlantillaOpcion,
} from '@/components/features/expedientes/formulario-expediente';

export const metadata: Metadata = { title: 'Nuevo expediente' };

export default async function NuevoExpedientePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'expediente:create');
  const db = tenantClient(contexto.organisation.id);

  const [plantillas, contratos] = await Promise.all([
    db.plantillaProcedimiento.findMany({
      where: { deletedAt: null, activa: true },
      include: { hitos: { orderBy: { orden: 'asc' } } },
      orderBy: { nombre: 'asc' },
    }),
    db.contrato.findMany({
      where: { deletedAt: null },
      select: { id: true, numeroExpediente: true, objeto: true },
      orderBy: { numeroExpediente: 'asc' },
    }),
  ]);

  const opcionesPlantilla: PlantillaOpcion[] = plantillas.map((plantilla) => ({
    id: plantilla.id,
    nombre: plantilla.nombre,
    tipo: plantilla.tipo,
    jurisdiccion: plantilla.jurisdiccion,
    descripcion: plantilla.descripcion ?? undefined,
    pasos: plantilla.hitos.map((hito) => ({
      nombre: hito.nombre,
      plazo:
        hito.plazoCantidad && hito.plazoComputo
          ? describirComputo(hito.plazoCantidad, hito.plazoComputo)
          : undefined,
    })),
  }));

  // Only the types a template exists for are offered first; the rest follow, so
  // an unusual expediente is still possible without a template.
  const tipos = Object.entries(ETIQUETA_TIPO_EXPEDIENTE).map(([valor, etiqueta]) => ({
    valor,
    etiqueta,
  }));

  const jurisdicciones = Object.entries(ETIQUETA_JURISDICCION).map(([valor, etiqueta]) => ({
    valor,
    etiqueta,
  }));

  const accion = crearExpediente.bind(null, orgSlug);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <Link
          href={`/${orgSlug}/expedientes`}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          ← Expedientes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nuevo expediente</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Al abrirlo se crean sus hitos y se calculan sus plazos. Ninguna fecha queda como
          firme: todas nacen pendientes de que alguien las confirme.
        </p>
      </div>

      <FormularioExpediente
        accion={accion}
        plantillas={opcionesPlantilla}
        contratos={contratos.map((c) => ({
          valor: c.id,
          etiqueta: `${c.numeroExpediente} — ${c.objeto}`,
        }))}
        tipos={tipos}
        jurisdicciones={jurisdicciones}
        hoy={hoyEn(contexto.organisation.timezone)}
      />
    </div>
  );
}
