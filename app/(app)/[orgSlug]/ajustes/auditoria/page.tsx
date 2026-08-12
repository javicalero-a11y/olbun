import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { ETIQUETA_ROL } from '@/lib/auth/etiquetas';

export const metadata: Metadata = { title: 'Auditoría' };

const ETIQUETA_TIPO: Record<string, { texto: string; clase: string }> = {
  CREACION: { texto: 'Creación', clase: 'text-status-green' },
  MODIFICACION: { texto: 'Modificación', clase: 'text-foreground' },
  BORRADO: { texto: 'Borrado', clase: 'text-status-red' },
  ACCESO: { texto: 'Acceso', clase: 'text-muted-foreground' },
  EXPORTACION: { texto: 'Exportación', clase: 'text-status-amber' },
  ACCESO_DENEGADO: { texto: 'Acceso denegado', clase: 'text-status-red' },
  AUTENTICACION: { texto: 'Autenticación', clase: 'text-muted-foreground' },
};

function fechaHora(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

/**
 * The audit trail, read-only by construction: the table refuses UPDATE and
 * DELETE at the database level, so there is no editing affordance to leave out.
 */
export default async function AuditoriaPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'audit:view');
  const db = tenantClient(contexto.organisation.id);

  const eventos = await db.auditEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Auditoría</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Quién hizo qué, y cuándo. El registro es de sólo inserción: la base de datos rechaza
          modificarlo o borrarlo, también para nosotros. Se muestran los 200 eventos más
          recientes.
        </p>
      </div>

      {eventos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h2 className="text-sm font-semibold">Todavía no hay eventos</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Cada alta, cambio y borrado queda aquí en cuanto alguien empiece a trabajar.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <caption className="sr-only">
              Eventos de auditoría, del más reciente al más antiguo
            </caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Cuándo
                </th>
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Quién
                </th>
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Qué
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Sobre
                </th>
              </tr>
            </thead>
            <tbody>
              {eventos.map((evento) => {
                const tipo = ETIQUETA_TIPO[evento.tipo];

                return (
                  <tr
                    key={evento.id}
                    className="border-b border-border align-top last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-xs whitespace-nowrap" data-numeric>
                      {fechaHora(evento.createdAt)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs">
                      {evento.actorEmail ?? '—'}
                      {evento.actorRol ? (
                        <span className="block text-muted-foreground">
                          {ETIQUETA_ROL[evento.actorRol]}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-xs">
                      <span className={`font-medium ${tipo?.clase ?? ''}`}>
                        {tipo?.texto ?? evento.tipo}
                      </span>
                      <span className="block text-muted-foreground">{evento.accion}</span>
                    </td>
                    <td className="py-2.5 text-xs">
                      {evento.descripcion ?? evento.entidad}
                      <span className="block text-muted-foreground">{evento.entidad}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
