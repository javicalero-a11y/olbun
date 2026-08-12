import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { ETIQUETA_ROL } from '@/lib/auth/etiquetas';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';

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

      <Tabla
        titulo="Eventos de auditoría, del más reciente al más antiguo"
        anchoMinimo="820px"
        filas={eventos}
        claveDeFila={(evento) => evento.id}
        vacio={
          <EstadoVacio
            titulo="Todavía no hay eventos"
            explicacion="Cada alta, cambio y borrado queda aquí en cuanto alguien empiece a trabajar."
          />
        }
        columnas={[
          {
            clave: 'cuando',
            encabezado: 'Cuándo',
            numerica: true,
            clase: 'whitespace-nowrap text-xs',
            celda: (evento) => fechaHora(evento.createdAt),
          },
          {
            clave: 'quien',
            encabezado: 'Quién',
            clase: 'text-xs',
            celda: (evento) => (
              <>
                {evento.actorEmail ?? '—'}
                {evento.actorRol ? (
                  <span className="block text-muted-foreground">
                    {ETIQUETA_ROL[evento.actorRol]}
                  </span>
                ) : null}
              </>
            ),
          },
          {
            clave: 'que',
            encabezado: 'Qué',
            clase: 'text-xs',
            celda: (evento) => {
              const tipo = ETIQUETA_TIPO[evento.tipo];
              return (
                <>
                  <span className={`font-medium ${tipo?.clase ?? ''}`}>
                    {tipo?.texto ?? evento.tipo}
                  </span>
                  <span className="block text-muted-foreground">{evento.accion}</span>
                </>
              );
            },
          },
          {
            clave: 'sobre',
            encabezado: 'Sobre',
            esCabeceraDeFila: true,
            clase: 'text-xs',
            celda: (evento) => (
              <>
                {evento.descripcion ?? evento.entidad}
                <span className="block text-muted-foreground">{evento.entidad}</span>
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
