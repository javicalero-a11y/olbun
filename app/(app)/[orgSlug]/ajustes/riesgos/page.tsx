import type { Metadata } from 'next';

import { ConfiguracionRiesgos } from '@/components/features/ajustes/configuracion-riesgos';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { actualizarBandas, actualizarCategoria, crearCategoria } from './acciones';

export const metadata: Metadata = { title: 'Configuración de riesgos' };

export default async function AjustesRiesgosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'settings:manage');
  const db = tenantClient(contexto.organisation.id);

  const [categorias, bandas] = await Promise.all([
    db.categoriaRiesgo.findMany({
      where: { deletedAt: null },
      select: { id: true, clave: true, nombre: true, color: true, isActive: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
    db.bandaRiesgo.findMany({
      where: { deletedAt: null },
      select: {
        nivel: true,
        nombre: true,
        puntuacionMinima: true,
        puntuacionMaxima: true,
        color: true,
      },
      orderBy: { orden: 'asc' },
    }),
  ]);

  return (
    <ConfiguracionRiesgos
      categorias={categorias}
      bandas={bandas}
      crearCategoria={crearCategoria.bind(null, orgSlug)}
      actualizarCategoria={actualizarCategoria.bind(null, orgSlug)}
      actualizarBandas={actualizarBandas.bind(null, orgSlug)}
    />
  );
}
