import type { Metadata } from 'next';

import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { can } from '@/lib/auth/can';
import { explicarRetencion } from '@/lib/domain/documentos/retencion';
import { ListaPurga } from '@/components/features/documentos/lista-purga';
import { purgar } from './acciones';
import { requirePermission } from '@/lib/auth/guardias';
import { resumenDeRetencion } from '@/lib/services/retencion';
import { tenantClient } from '@/lib/db/tenant';
import type { DocumentoConRetencion } from '@/lib/services/retencion';

export const metadata: Metadata = { title: 'Conservación' };

function fechaCorta(valor: Date | null): string {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

/**
 * Retention: what is due for deletion, and what is about to be.
 *
 * Deliberately not a job that runs at three in the morning. Two obligations
 * meet here — contracting law says keep the file, the RGPD says do not keep
 * personal data longer than necessary — and the resolution is a person
 * applying a policy, with the audit trail to show it was applied.
 */
export default async function RetencionPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'documento:view');
  const db = tenantClient(contexto.organisation.id);

  const resumen = await resumenDeRetencion(db);
  const puedePurgar = can(contexto.actor, 'documento:delete');

  const columnas = [
    {
      clave: 'nombre',
      encabezado: 'Documento',
      esCabeceraDeFila: true,
      celda: (fila: DocumentoConRetencion) => fila.nombre,
    },
    {
      clave: 'tipo',
      encabezado: 'Tipo',
      celda: (fila: DocumentoConRetencion) => fila.tipoNombre ?? 'Sin tipo',
    },
    {
      clave: 'caduca',
      encabezado: 'Caduca',
      celda: (fila: DocumentoConRetencion) => fechaCorta(fila.retencion.caducaEl),
    },
    {
      clave: 'origen',
      encabezado: 'Cuenta desde',
      celda: (fila: DocumentoConRetencion) =>
        fila.origenInicio === 'FIN_DE_CONTRATO'
          ? `Fin del contrato (${fechaCorta(fila.inicio)})`
          : `Fecha del documento (${fechaCorta(fila.inicio)})`,
    },
    {
      clave: 'estado',
      encabezado: 'Estado',
      celda: (fila: DocumentoConRetencion) => (
        <span className="text-status-amber">{explicarRetencion(fila.retencion)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Conservación y purga</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          El plazo cuenta desde el fin del contrato cuando lo hay y, si no, desde la fecha del
          documento. Nada se borra solo: aquí se ve lo que ha cumplido plazo y una persona
          decide.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { termino: 'Documentos vivos', valor: resumen.total },
          { termino: 'Caducados', valor: resumen.caducados.length },
          { termino: 'Por caducar', valor: resumen.porCaducar.length },
          { termino: 'Sin política', valor: resumen.sinPolitica },
        ].map((dato) => (
          <div key={dato.termino} className="rounded-lg border border-border p-4">
            <dt className="text-sm text-muted-foreground">{dato.termino}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{dato.valor}</dd>
          </div>
        ))}
      </dl>

      {resumen.bloqueados > 0 ? (
        <p className="rounded-md bg-muted px-4 py-3 text-sm">
          {resumen.bloqueados}{' '}
          {resumen.bloqueados === 1
            ? 'documento está bloqueado'
            : 'documentos están bloqueados'}{' '}
          por litigio y no aparecen aquí: mientras el litigio siga abierto no caducan, diga lo
          que diga la política.
        </p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Han cumplido plazo</h2>
        {puedePurgar ? (
          <ListaPurga
            purgar={purgar.bind(null, orgSlug)}
            filas={resumen.caducados.map((documento) => ({
              id: documento.id,
              nombre: documento.nombre,
              tipoNombre: documento.tipoNombre,
              versiones: documento.versiones,
              caducoEl: fechaCorta(documento.retencion.caducaEl),
              explicacion: explicarRetencion(documento.retencion),
            }))}
            vacio={
              <EstadoVacio
                titulo="Nada ha cumplido plazo"
                explicacion="Cuando un documento supere el plazo de conservación de su tipo aparecerá aquí para que alguien decida si se purga. Los bloqueados por litigio nunca llegan a esta lista."
              />
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {resumen.caducados.length}{' '}
            {resumen.caducados.length === 1 ? 'documento ha' : 'documentos han'} cumplido plazo.
            Purgar requiere el permiso de borrado de documentos.
          </p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Caducan en los próximos 90 días</h2>
        <Tabla
          titulo="Documentos próximos a cumplir su plazo de conservación"
          columnas={columnas}
          filas={resumen.porCaducar}
          claveDeFila={(fila) => fila.id}
          vacio={
            <EstadoVacio
              titulo="Ninguno caduca pronto"
              explicacion="Se avisa con noventa días de antelación para que una purga no sea nunca una sorpresa."
            />
          }
        />
      </section>
    </div>
  );
}
