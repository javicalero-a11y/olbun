import type { Metadata } from 'next';
import Link from 'next/link';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { FormularioSubida } from '@/components/features/comunicaciones/formulario-subida';
import { subirComunicacion } from './acciones';

export const metadata: Metadata = { title: 'Comunicaciones' };

const ETIQUETA_REVISION: Record<string, { texto: string; clase: string }> = {
  SIN_REVISAR: { texto: 'Sin revisar', clase: 'text-status-amber' },
  REVISADA: { texto: 'Revisada', clase: 'text-status-green' },
  ARCHIVADA: { texto: 'Archivada', clase: 'text-muted-foreground' },
};

function fechaCorta(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

/**
 * The inbox.
 *
 * Unreviewed first, then newest: the question this screen answers is "what has
 * arrived that nobody has looked at", not "what arrived most recently".
 */
export default async function ComunicacionesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'comunicacion:view');
  const db = tenantClient(contexto.organisation.id);

  const [comunicaciones, contratos] = await Promise.all([
    db.comunicacion.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        asunto: true,
        de: true,
        fechaRecepcion: true,
        direccion: true,
        estadoRevision: true,
        contrato: { select: { numeroExpediente: true } },
        _count: { select: { adjuntos: true } },
      },
      orderBy: [{ estadoRevision: 'asc' }, { fechaRecepcion: 'desc' }],
      take: 200,
    }),
    db.contrato.findMany({
      where: { deletedAt: null },
      select: { id: true, numeroExpediente: true, objeto: true },
      orderBy: { numeroExpediente: 'asc' },
    }),
  ]);

  const accion = subirComunicacion.bind(null, orgSlug);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comunicaciones</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          La correspondencia del contrato, en un sitio y sin duplicados. De momento se carga a
          mano; los buzones conectados y el alias de reenvío llegan después.
        </p>
      </div>

      <FormularioSubida
        accion={accion}
        contratos={contratos.map((contrato) => ({
          id: contrato.id,
          etiqueta: `${contrato.numeroExpediente} — ${contrato.objeto}`,
        }))}
      />

      <Tabla
        titulo="Correspondencia recibida, primero lo que nadie ha revisado"
        anchoMinimo="760px"
        filas={comunicaciones}
        claveDeFila={(comunicacion) => comunicacion.id}
        vacio={
          <EstadoVacio
            titulo="Aquí vivirá la correspondencia"
            explicacion="Los requerimientos, las quejas y los avisos de penalidad llegan por correo, y es donde primero aparece un problema. Reunirlos aquí es lo que permitirá detectarlos antes de que se conviertan en un expediente."
          />
        }
        columnas={[
          {
            clave: 'asunto',
            encabezado: 'Asunto',
            esCabeceraDeFila: true,
            celda: (comunicacion) => (
              <>
                <span className="text-sm font-medium">{comunicacion.asunto}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {comunicacion.direccion === 'ENTRANTE' ? 'De' : 'Para'} {comunicacion.de}
                  {comunicacion._count.adjuntos > 0
                    ? ` · ${String(comunicacion._count.adjuntos)} adjunto${
                        comunicacion._count.adjuntos === 1 ? '' : 's'
                      }`
                    : ''}
                </p>
              </>
            ),
          },
          {
            clave: 'contrato',
            encabezado: 'Contrato',
            clase: 'text-xs text-muted-foreground',
            celda: (comunicacion) => comunicacion.contrato?.numeroExpediente ?? 'Sin vincular',
          },
          {
            clave: 'estado',
            encabezado: 'Estado',
            celda: (comunicacion) => {
              const estado = ETIQUETA_REVISION[comunicacion.estadoRevision];
              return (
                <span className={`text-xs font-medium ${estado?.clase ?? ''}`}>
                  {estado?.texto ?? comunicacion.estadoRevision}
                </span>
              );
            },
          },
          {
            clave: 'fecha',
            encabezado: 'Fecha',
            numerica: true,
            clase: 'text-xs whitespace-nowrap',
            celda: (comunicacion) => fechaCorta(comunicacion.fechaRecepcion),
          },
        ]}
      />

      <p className="text-xs text-muted-foreground">
        <Link href={`/${orgSlug}/contratos`} className="underline underline-offset-4">
          Ver contratos
        </Link>
      </p>
    </div>
  );
}
