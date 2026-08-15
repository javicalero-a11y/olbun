import Link from 'next/link';
import type { Metadata } from 'next';

import { crearAdscripcionAction, crearPlantillaAction } from './acciones';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { isScopedRole } from '@/lib/auth/permissions';
import { PanelPlantilla } from '@/components/features/personal/panel-plantilla';
import { tenantClient } from '@/lib/db/tenant';
import { coberturaBasePorCategoria } from '@/lib/domain/personal/adscripciones';
import { hoyEn } from '@/lib/domain/fecha';

export const metadata: Metadata = { title: 'Plantilla contractual' };

export default async function PlantillaPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'empleado:view');
  const db = tenantClient(contexto.organisation.id);
  const scoped = isScopedRole(contexto.actor.role);
  const hoy = hoyEn(contexto.organisation.timezone);
  const fechaHoy = new Date(`${hoy}T00:00:00.000Z`);
  const contratos = await db.contrato.findMany({
    where: {
      deletedAt: null,
      ...(scoped ? { id: { in: [...contexto.actor.contratoIds] } } : {}),
    },
    select: {
      id: true,
      numeroExpediente: true,
      objeto: true,
      plantillaExigida: {
        where: { deletedAt: null },
        select: { categoriaId: true, centroTrabajo: true, horasSemanales: true },
      },
      adscripciones: {
        where: {
          deletedAt: null,
          fechaAlta: { lte: fechaHoy },
          OR: [{ fechaBaja: null }, { fechaBaja: { gte: fechaHoy } }],
          empleado: { estado: 'ACTIVO', deletedAt: null },
        },
        select: { categoriaId: true, centroTrabajo: true, horasSemanales: true },
      },
    },
    orderBy: { numeroExpediente: 'asc' },
  });
  const [empleados, categorias] = await Promise.all([
    db.empleado.findMany({
      where: {
        deletedAt: null,
        estado: 'ACTIVO',
        ...(scoped
          ? {
              adscripciones: {
                some: { contratoId: { in: [...contexto.actor.contratoIds] }, deletedAt: null },
              },
            }
          : {}),
      },
      select: { id: true, nombre: true, apellidos: true },
      orderBy: { apellidos: 'asc' },
    }),
    db.categoriaProfesional.findMany({
      where: { deletedAt: null },
      select: { id: true, denominacion: true },
      orderBy: { denominacion: 'asc' },
    }),
  ]);
  const nombresCategoria = new Map(
    categorias.map((categoria) => [categoria.id, categoria.denominacion]),
  );
  const coberturas = contratos.flatMap((contrato) =>
    coberturaBasePorCategoria(
      contrato.plantillaExigida.map((fila) => ({
        categoriaId: fila.categoriaId,
        centroTrabajo: fila.centroTrabajo,
        horas: Number(fila.horasSemanales),
      })),
      contrato.adscripciones.map((fila) => ({
        categoriaId: fila.categoriaId,
        centroTrabajo: fila.centroTrabajo,
        horas: Number(fila.horasSemanales),
      })),
    ).map((fila) => ({ ...fila, contrato })),
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
        <h1 className="mt-2 text-2xl font-semibold">Plantilla y adscripción contractual</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Comparación base entre horas exigidas por pliego y horas adscritas, siempre por
          categoría y centro. Las bajas y vacaciones se descontarán en M12.
        </p>
      </header>
      {can(contexto.actor, 'empleado:manage') ? (
        <PanelPlantilla
          acciones={{
            adscripcion: crearAdscripcionAction.bind(null, orgSlug),
            exigencia: crearPlantillaAction.bind(null, orgSlug),
          }}
          empleados={empleados.map((empleado) => ({
            id: empleado.id,
            nombre: `${empleado.apellidos}, ${empleado.nombre}`,
          }))}
          contratos={contratos.map((contrato) => ({
            id: contrato.id,
            nombre: `${contrato.numeroExpediente} — ${contrato.objeto}`,
          }))}
          categorias={categorias.map((categoria) => ({
            id: categoria.id,
            nombre: categoria.denominacion,
          }))}
          hoy={hoy}
        />
      ) : null}
      <section>
        <h2 className="mb-3 text-base font-semibold">Cobertura base por categoría</h2>
        {coberturas.length ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Contrato</th>
                  <th>Centro</th>
                  <th>Categoría</th>
                  <th>Exigidas</th>
                  <th>Adscritas</th>
                  <th>Cobertura</th>
                  <th>Déficit</th>
                </tr>
              </thead>
              <tbody>
                {coberturas.map((fila) => (
                  <tr
                    key={`${fila.contrato.id}:${fila.centroTrabajo}:${fila.categoriaId}`}
                    className="border-t border-border"
                  >
                    <td className="px-3 py-2 font-medium">{fila.contrato.numeroExpediente}</td>
                    <td>{fila.centroTrabajo}</td>
                    <td>{nombresCategoria.get(fila.categoriaId) ?? 'Categoría retirada'}</td>
                    <td className="tabular-nums">{fila.exigidas.toLocaleString('es-ES')} h</td>
                    <td className="tabular-nums">{fila.adscritas.toLocaleString('es-ES')} h</td>
                    <td>
                      <span
                        className={
                          fila.porcentaje < 100 ? 'text-destructive' : 'text-status-green'
                        }
                      >
                        {fila.porcentaje.toLocaleString('es-ES')}% ·{' '}
                        {fila.porcentaje < 100 ? 'Insuficiente' : 'Cubierta'}
                      </span>
                    </td>
                    <td className="tabular-nums">{fila.deficit.toLocaleString('es-ES')} h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Registra primero la plantilla mínima citando el pliego. Después las adscripciones
            mostrarán la diferencia.
          </p>
        )}
      </section>
    </div>
  );
}
