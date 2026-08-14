import Link from 'next/link';
import type { Metadata } from 'next';

import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { ListaPapelera } from '@/components/features/documentos/lista-papelera';
import { restaurar } from '../acciones';

export const metadata: Metadata = { title: 'Papelera de documentos' };

export default async function PapeleraPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'documento:view');
  const puedeRestaurar = can(contexto.actor, 'documento:restore');
  const documentos = puedeRestaurar
    ? await tenantClient(contexto.organisation.id).documento.findMany({
        where: { deletedAt: { not: null } },
        select: {
          id: true,
          nombre: true,
          motivoBorrado: true,
          deletedAt: true,
          _count: { select: { versiones: true } },
        },
        orderBy: { deletedAt: 'desc' },
      })
    : [];

  const fecha = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeZone: 'Europe/Madrid',
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/${orgSlug}/documentos`}
          className="text-sm text-muted-foreground underline underline-offset-4"
        >
          Volver a documentos
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Papelera</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          El borrado ordinario conserva todas las versiones y sus bytes. Restaurar devuelve el
          documento exactamente como estaba; la auditoría conserva ambas acciones.
        </p>
      </div>
      {puedeRestaurar ? (
        <ListaPapelera
          restaurar={restaurar.bind(null, orgSlug)}
          destinoRestaurado={`/${orgSlug}/documentos?restaurado=1`}
          documentos={documentos.map((documento) => ({
            id: documento.id,
            nombre: documento.nombre,
            motivo: documento.motivoBorrado ?? 'No consta',
            borradoEl: fecha.format(documento.deletedAt ?? new Date()),
            versiones: documento._count.versiones,
          }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          No tienes permiso para restaurar documentos.
        </p>
      )}
    </div>
  );
}
