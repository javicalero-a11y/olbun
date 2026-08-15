import Link from 'next/link';
import type { Metadata } from 'next';

import { crearCertificacionAction, crearTipoCertificacionAction } from './acciones';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { isScopedRole } from '@/lib/auth/permissions';
import { PanelCertificaciones } from '@/components/features/personal/panel-certificaciones';
import { tenantClient } from '@/lib/db/tenant';
import { hoyEn } from '@/lib/domain/fecha';
import { estadoDeCertificacion } from '@/lib/domain/personal/caducidades';

export const metadata: Metadata = { title: 'Certificaciones del personal' };

export default async function CertificacionesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'empleado:view');
  const db = tenantClient(contexto.organisation.id);
  const scoped = isScopedRole(contexto.actor.role);
  const [empleados, tipos, certificados] = await Promise.all([
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
      select: { id: true, numeroEmpleado: true, nombre: true, apellidos: true },
      orderBy: { apellidos: 'asc' },
    }),
    db.tipoCertificacion.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, nombre: true, diasAviso: true, esObligatoria: true },
      orderBy: { nombre: 'asc' },
    }),
    db.certificacionEmpleado.findMany({
      where: {
        deletedAt: null,
        ...(scoped
          ? {
              empleado: {
                adscripciones: {
                  some: {
                    contratoId: { in: [...contexto.actor.contratoIds] },
                    deletedAt: null,
                  },
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        fechaCaducidad: true,
        estado: true,
        emitidaPor: true,
        empleado: { select: { id: true, numeroEmpleado: true, nombre: true, apellidos: true } },
        tipo: { select: { nombre: true, diasAviso: true, esObligatoria: true } },
      },
      orderBy: { fechaCaducidad: 'asc' },
    }),
  ]);
  const hoy = hoyEn(contexto.organisation.timezone);
  const filas = certificados.map((certificado) => ({
    ...certificado,
    estadoActual:
      certificado.estado === 'REVOCADA' || certificado.estado === 'PENDIENTE_RENOVACION'
        ? certificado.estado
        : estadoDeCertificacion(
            certificado.fechaCaducidad?.toISOString().slice(0, 10),
            hoy,
            certificado.tipo.diasAviso,
          ),
  }));
  const fecha = (valor: Date | null) =>
    valor
      ? new Intl.DateTimeFormat('es-ES', {
          dateStyle: 'medium',
          timeZone: 'Europe/Madrid',
        }).format(valor)
      : 'No caduca';
  return (
    <div className="space-y-8">
      <header>
        <Link
          href={`/${orgSlug}/personal`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Personal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Certificaciones y caducidades</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          PRL, habilitaciones y formación que condicionan quién puede prestar el servicio. El
          estado se calcula contra el día civil de Madrid.
        </p>
      </header>
      {can(contexto.actor, 'empleado:manage') ? (
        <PanelCertificaciones
          acciones={{
            tipo: crearTipoCertificacionAction.bind(null, orgSlug),
            certificacion: crearCertificacionAction.bind(null, orgSlug),
          }}
          empleados={empleados.map((empleado) => ({
            id: empleado.id,
            nombre: `${empleado.apellidos}, ${empleado.nombre} · ${empleado.numeroEmpleado}`,
          }))}
          tipos={tipos.map((tipo) => ({ id: tipo.id, nombre: tipo.nombre }))}
        />
      ) : null}
      <section>
        <h2 className="mb-3 text-base font-semibold">Matriz registrada</h2>
        {filas.length ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Empleado</th>
                  <th>Certificación</th>
                  <th>Obligatoria</th>
                  <th>Caducidad</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((fila) => (
                  <tr key={fila.id} className="border-t border-border">
                    <td className="px-3 py-2">
                      <Link
                        href={`/${orgSlug}/personal/${fila.empleado.id}`}
                        className="font-medium hover:underline"
                      >
                        {fila.empleado.apellidos}, {fila.empleado.nombre}
                      </Link>
                    </td>
                    <td>{fila.tipo.nombre}</td>
                    <td>{fila.tipo.esObligatoria ? 'Sí' : 'No'}</td>
                    <td>{fecha(fila.fechaCaducidad)}</td>
                    <td>
                      <span
                        className={
                          fila.estadoActual === 'CADUCADA'
                            ? 'text-destructive'
                            : fila.estadoActual === 'PROXIMA_A_CADUCAR'
                              ? 'text-status-amber'
                              : 'text-status-green'
                        }
                      >
                        {fila.estadoActual.replaceAll('_', ' ')} ·{' '}
                        {fila.estadoActual === 'VALIDA' ? 'Al día' : 'Requiere atención'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            Crea los tipos aplicables y registra el primer certificado. La referencia queda
            cifrada.
          </p>
        )}
      </section>
    </div>
  );
}
