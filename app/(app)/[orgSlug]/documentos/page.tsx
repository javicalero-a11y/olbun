import type { Metadata } from 'next';

import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { fragmentoAlrededor } from '@/lib/domain/documentos/texto';
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
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgSlug } = await params;
  const { q } = await searchParams;
  const consulta = q?.trim() ?? '';
  const contexto = await requirePermission(orgSlug, 'documento:view');
  const db = tenantClient(contexto.organisation.id);

  const [documentos, tipos, expedientes] = await Promise.all([
    db.documento.findMany({
      where: {
        deletedAt: null,
        // Searches the name, the description and the extracted text at once:
        // people look for a document by what it is called *or* by a phrase
        // they remember from inside it, and asking which is unreasonable.
        // `insensitive` covers case; accents are handled by the domain helper
        // when highlighting, and Postgres's es-ES collation does the rest.
        ...(consulta
          ? {
              OR: [
                { nombre: { contains: consulta, mode: 'insensitive' as const } },
                { descripcion: { contains: consulta, mode: 'insensitive' as const } },
                {
                  versiones: {
                    some: {
                      deletedAt: null,
                      textoExtraido: { contains: consulta, mode: 'insensitive' as const },
                    },
                  },
                },
              ],
            }
          : {}),
      },
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
            textoExtraido: true,
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
    .map((documento) => ({
      ...documento,
      actual: documento.versiones[0],
      // The line of the document the search matched, if it matched inside one.
      fragmento: consulta
        ? fragmentoAlrededor(documento.versiones[0]?.textoExtraido ?? '', consulta)
        : null,
    }))
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

      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar en los documentos
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={consulta}
          placeholder="Buscar por nombre o por lo que dice dentro"
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md border border-input px-3 py-2 text-sm font-medium"
        >
          Buscar
        </button>
      </form>

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
          consulta ? (
            <EstadoVacio
              titulo="Nada coincide con esa búsqueda"
              explicacion="Se busca en el nombre, la descripción y el texto de los documentos que se han podido leer. Los PDF y los escaneados todavía no se indexan, así que puede estar ahí sin aparecer."
            />
          ) : (
            <EstadoVacio
              titulo="Todavía no hay documentos"
              explicacion="Aquí van los pliegos, las actas de inicio, los requerimientos y las resoluciones. Guardarlos con su versión y su fecha es lo que permite responder a una inspección sin buscar en el correo de nadie."
            />
          )
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
                  {documento.actual?.textoExtraido === null ? ' · Sin indexar' : ''}
                </p>
                {documento.fragmento ? (
                  <p className="mt-1 border-l-2 border-border pl-2 text-xs text-muted-foreground italic">
                    {documento.fragmento}
                  </p>
                ) : null}
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
