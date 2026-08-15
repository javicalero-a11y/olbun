import Link from 'next/link';
import type { Metadata } from 'next';

import {
  crearCategoriaAction,
  crearConvenioAction,
  crearTablaAction,
  vincularConvenioAction,
} from './acciones';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { PanelConvenios } from '@/components/features/personal/panel-convenios';
import { tenantClient } from '@/lib/db/tenant';
import { hoyEn } from '@/lib/domain/fecha';
import { formatearEuros } from '@/lib/domain/contratos/etiquetas';

export const metadata: Metadata = { title: 'Convenios colectivos' };

export default async function ConveniosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'convenio:view');
  const db = tenantClient(contexto.organisation.id);
  const [convenios, contratos] = await Promise.all([
    db.convenioColectivo.findMany({
      where: { deletedAt: null },
      include: {
        categorias: {
          where: { deletedAt: null },
          include: {
            tablas: {
              where: { deletedAt: null },
              orderBy: [{ ano: 'desc' }, { vigenciaDesde: 'desc' }],
            },
          },
          orderBy: { denominacion: 'asc' },
        },
        contratos: {
          where: { deletedAt: null },
          include: { contrato: { select: { numeroExpediente: true } } },
        },
      },
      orderBy: { nombre: 'asc' },
    }),
    db.contrato.findMany({
      where: { deletedAt: null },
      select: { id: true, numeroExpediente: true, objeto: true },
      orderBy: { numeroExpediente: 'asc' },
    }),
  ]);
  const categorias = convenios.flatMap((convenio) =>
    convenio.categorias.map((categoria) => ({
      id: categoria.id,
      convenioId: convenio.id,
      nombre: `${categoria.denominacion} — ${convenio.nombre}`,
    })),
  );
  return (
    <div className="space-y-8">
      <header>
        <Link
          href={`/${orgSlug}/personal`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Personal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Convenios y tablas salariales</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          La norma pública aplicable se separa de la retribución individual. Cada tabla conserva
          año y vigencia para poder justificar cálculos posteriores.
        </p>
      </header>
      {can(contexto.actor, 'convenio:manage') ? (
        <PanelConvenios
          acciones={{
            convenio: crearConvenioAction.bind(null, orgSlug),
            categoria: crearCategoriaAction.bind(null, orgSlug),
            tabla: crearTablaAction.bind(null, orgSlug),
            vinculo: vincularConvenioAction.bind(null, orgSlug),
          }}
          convenios={convenios.map((convenio) => ({
            id: convenio.id,
            nombre: convenio.nombre,
          }))}
          categorias={categorias}
          contratos={contratos.map((contrato) => ({
            id: contrato.id,
            etiqueta: `${contrato.numeroExpediente} — ${contrato.objeto}`,
          }))}
          hoy={hoyEn(contexto.organisation.timezone)}
        />
      ) : null}
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Convenios registrados</h2>
        {convenios.length ? (
          convenios.map((convenio) => (
            <article key={convenio.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{convenio.nombre}</h3>
                  <p className="text-sm text-muted-foreground">
                    {convenio.ambito.toLowerCase()} · {convenio.sector}
                    {convenio.provincia ? ` · ${convenio.provincia}` : ''}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Contratos:{' '}
                  {convenio.contratos
                    .map((vinculo) => vinculo.contrato.numeroExpediente)
                    .join(', ') || 'ninguno'}
                </p>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2">Categoría</th>
                      <th>Grupo SS</th>
                      <th>Tabla</th>
                      <th>Base mensual</th>
                      <th>Precio hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convenio.categorias.map((categoria) => {
                      const tabla = categoria.tablas[0];
                      return (
                        <tr key={categoria.id} className="border-t border-border">
                          <td className="py-2">{categoria.denominacion}</td>
                          <td>{categoria.grupoCotizacionSS}</td>
                          <td>{tabla?.ano ?? '—'}</td>
                          <td>
                            {tabla ? formatearEuros(Number(tabla.salarioBaseMensual)) : '—'}
                          </td>
                          <td>
                            {tabla
                              ? `${Number(tabla.precioHoraOrdinaria).toLocaleString('es-ES', { minimumFractionDigits: 4 })} €`
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </article>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Registra el convenio antes de crear categorías y tablas.
          </p>
        )}
      </section>
    </div>
  );
}
