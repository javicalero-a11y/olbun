import type { Metadata } from 'next';

import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { FormularioSubidaDocumento } from '@/components/features/documentos/formulario-subida';
import { requirePermission } from '@/lib/auth/guardias';
import { subir } from './acciones';
import { tenantClient } from '@/lib/db/tenant';

export const metadata: Metadata = { title: 'Documentos' };

const ETIQUETA_ANALISIS: Record<string, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Sin analizar', clase: 'text-status-amber' },
  LIMPIO: { texto: 'Limpio', clase: 'text-status-green' },
  INFECTADO: { texto: 'Rechazado', clase: 'text-destructive' },
  NO_ANALIZADO: { texto: 'No analizado', clase: 'text-muted-foreground' },
};

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fechaCorta(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

/**
 * The document store.
 *
 * Shows the current version of each document with its history behind it,
 * rather than a flat list of every version ever uploaded — the question is
 * "what is the contract", not "what happened to the file".
 */
export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'documento:view');
  const db = tenantClient(contexto.organisation.id);

  const [documentos, tipos, expedientes] = await Promise.all([
    db.documento.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        bloqueadoPorLitigio: true,
        tipo: { select: { nombre: true, retencionAnios: true } },
        expediente: { select: { referencia: true } },
        versiones: {
          where: { deletedAt: null },
          select: {
            id: true,
            numero: true,
            tamano: true,
            estadoAnalisis: true,
            createdAt: true,
          },
          orderBy: { numero: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    db.tipoDocumento.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    }),
    db.expediente.findMany({
      where: { deletedAt: null },
      select: { id: true, referencia: true, titulo: true },
      orderBy: { referencia: 'desc' },
      take: 100,
    }),
  ]);

  const filas = documentos
    .map((documento) => ({ ...documento, actual: documento.versiones[0] }))
    .filter((documento) => documento.actual !== undefined);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Pliegos, actas, resoluciones y todo lo que hay que poder enseñar. Cada subida es una
          versión nueva: lo anterior se conserva, porque la pregunta suele ser qué decía en
          marzo.
        </p>
      </div>

      <FormularioSubidaDocumento
        accion={subir.bind(null, orgSlug)}
        tipos={tipos}
        expedientes={expedientes.map((expediente) => ({
          id: expediente.id,
          etiqueta: `${expediente.referencia} — ${expediente.titulo}`,
        }))}
        documentos={filas.map((documento) => ({
          id: documento.id,
          etiqueta: `${documento.nombre} (v${String(documento.actual?.numero ?? 1)})`,
        }))}
      />

      <Tabla
        titulo="Documentos guardados, con su versión actual"
        anchoMinimo="860px"
        filas={filas}
        claveDeFila={(documento) => documento.id}
        vacio={
          <EstadoVacio
            titulo="Todavía no hay documentos"
            explicacion="Aquí van los pliegos, las actas de inicio, los requerimientos y las resoluciones. Guardarlos con su versión y su fecha es lo que permite responder a una inspección sin buscar en el correo de nadie."
          />
        }
        columnas={[
          {
            clave: 'nombre',
            encabezado: 'Documento',
            esCabeceraDeFila: true,
            celda: (documento) => (
              <>
                <a
                  href={`/api/documentos/${documento.actual?.id ?? ''}?org=${orgSlug}`}
                  className="text-sm font-medium underline underline-offset-4"
                >
                  {documento.nombre}
                </a>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {documento.tipo?.nombre ?? 'Sin clasificar'}
                  {documento.descripcion ? ` · ${documento.descripcion}` : ''}
                </p>
              </>
            ),
          },
          {
            clave: 'version',
            encabezado: 'Versión',
            numerica: true,
            clase: 'text-xs whitespace-nowrap',
            celda: (documento) => (
              <>
                v{String(documento.actual?.numero ?? 1)}
                {documento.versiones.length > 1 ? (
                  <span className="text-muted-foreground">
                    {' '}
                    de {String(documento.versiones.length)}
                  </span>
                ) : null}
              </>
            ),
          },
          {
            clave: 'analisis',
            encabezado: 'Antivirus',
            celda: (documento) => {
              const estado = ETIQUETA_ANALISIS[documento.actual?.estadoAnalisis ?? 'PENDIENTE'];
              return (
                <span className={`text-xs ${estado?.clase ?? ''}`}>{estado?.texto ?? '—'}</span>
              );
            },
          },
          {
            clave: 'expediente',
            encabezado: 'Expediente',
            clase: 'text-xs text-muted-foreground',
            celda: (documento) => documento.expediente?.referencia ?? 'Sin vincular',
          },
          {
            clave: 'retencion',
            encabezado: 'Conservación',
            clase: 'text-xs text-muted-foreground',
            celda: (documento) => {
              if (documento.bloqueadoPorLitigio) return 'Bloqueado por litigio';
              const anios = documento.tipo?.retencionAnios;
              return anios == null ? 'Sin política' : `${String(anios)} años`;
            },
          },
          {
            clave: 'tamano',
            encabezado: 'Tamaño',
            numerica: true,
            clase: 'text-xs whitespace-nowrap',
            celda: (documento) => tamanoLegible(documento.actual?.tamano ?? 0),
          },
          {
            clave: 'fecha',
            encabezado: 'Subido',
            numerica: true,
            clase: 'text-xs whitespace-nowrap',
            celda: (documento) =>
              documento.actual ? fechaCorta(documento.actual.createdAt) : '—',
          },
        ]}
      />
    </div>
  );
}
