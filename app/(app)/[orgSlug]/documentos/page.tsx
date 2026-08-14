import Link from 'next/link';
import type { Metadata } from 'next';

import { can } from '@/lib/auth/can';
import { AccionesDocumento } from '@/components/features/documentos/acciones-documento';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { fragmentoAlrededor } from '@/lib/domain/documentos/texto';
import { FormularioSubidaDocumento } from '@/components/features/documentos/formulario-subida';
import { requirePermission } from '@/lib/auth/guardias';
import { buscarIdsDocumento } from '@/lib/services/busqueda-documentos';
import { cambiarBloqueo, ejecutarOcr, eliminar, reanalizar, subir } from './acciones';
import { tenantClient } from '@/lib/db/tenant';

export const metadata: Metadata = { title: 'Documentos' };

const ETIQUETA_ANALISIS: Record<string, { texto: string; clase: string }> = {
  PENDIENTE: { texto: 'Sin analizar', clase: 'text-status-amber' },
  LIMPIO: { texto: 'Limpio', clase: 'text-status-green' },
  INFECTADO: { texto: 'Rechazado', clase: 'text-destructive' },
  NO_ANALIZADO: { texto: 'No analizado', clase: 'text-muted-foreground' },
};

const ETIQUETA_INDEXACION: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  EXTRAIDO: 'Texto indexado',
  OCR_PENDIENTE: 'Necesita OCR',
  OCR_COMPLETADO: 'OCR completo',
  OCR_PARCIAL: 'OCR parcial',
  NO_SOPORTADO: 'Formato sin texto',
  ERROR: 'Error de lectura',
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
  searchParams: Promise<{ q?: string; restaurado?: string }>;
}) {
  const { orgSlug } = await params;
  const { q, restaurado } = await searchParams;
  const consulta = q?.trim() ?? '';
  const contexto = await requirePermission(orgSlug, 'documento:view');
  const db = tenantClient(contexto.organisation.id);
  const idsCoincidentes = consulta
    ? await buscarIdsDocumento(contexto.organisation.id, consulta)
    : [];

  const [documentos, tipos, expedientes] = await Promise.all([
    db.documento.findMany({
      where: {
        deletedAt: null,
        ...(consulta ? { id: { in: idsCoincidentes } } : {}),
      },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        bloqueadoPorLitigio: true,
        bloqueadoEn: true,
        motivoBloqueo: true,
        tipo: { select: { nombre: true, retencionAnios: true } },
        expediente: { select: { referencia: true } },
        versiones: {
          where: { deletedAt: null },
          select: {
            id: true,
            numero: true,
            tamano: true,
            estadoAnalisis: true,
            estadoIndexacion: true,
            motivoAnalisis: true,
            motivoIndexacion: true,
            ocrPaginas: true,
            ocrConfianza: true,
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

  const orden = new Map(idsCoincidentes.map((id, indice) => [id, indice]));
  const documentosOrdenados = consulta
    ? documentos.toSorted((a, b) => (orden.get(a.id) ?? 999) - (orden.get(b.id) ?? 999))
    : documentos;
  const puedeBloquear = can(contexto.actor, 'documento:hold');
  const puedeEliminar = can(contexto.actor, 'documento:delete');

  const filas = documentosOrdenados
    .map((documento) => ({
      ...documento,
      actual: documento.versiones[0],
      fragmento: consulta
        ? (documento.versiones
            .map((version) => fragmentoAlrededor(version.textoExtraido ?? '', consulta))
            .find((valor) => valor !== null) ?? null)
        : null,
    }))
    .filter((documento) => documento.actual !== undefined);

  return (
    <div className="space-y-8">
      {restaurado === '1' ? (
        <p
          role="status"
          className="rounded-md border border-status-green/30 bg-status-green-subtle px-4 py-3 text-sm text-status-green"
        >
          Documento restaurado con todas sus versiones.
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documentos</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pliegos, actas, resoluciones y todo lo que hay que poder enseñar. Cada subida es una
            versión nueva: lo anterior se conserva, porque la pregunta suele ser qué decía en
            marzo.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/${orgSlug}/documentos/papelera`}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Papelera
          </Link>
          <Link
            href={`/${orgSlug}/documentos/retencion`}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
          >
            Conservación
          </Link>
        </div>
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
              explicacion="Se busca con el índice lingüístico español en el nombre, la descripción y todas las versiones limpias. Los escaneados aparecen en cuanto se ejecuta su OCR."
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
                {documento.actual?.estadoAnalisis === 'LIMPIO' ? (
                  <a
                    href={`/api/documentos/${documento.actual.id}?org=${orgSlug}`}
                    className="text-sm font-medium underline underline-offset-4"
                  >
                    {documento.nombre}
                  </a>
                ) : (
                  <span className="text-sm font-medium">{documento.nombre}</span>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {documento.tipo?.nombre ?? 'Sin clasificar'}
                  {documento.descripcion ? ` · ${documento.descripcion}` : ''}
                  {documento.actual
                    ? ` · ${ETIQUETA_INDEXACION[documento.actual.estadoIndexacion] ?? documento.actual.estadoIndexacion}`
                    : ''}
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
            encabezado: 'Seguridad e índice',
            celda: (documento) => {
              const estado = ETIQUETA_ANALISIS[documento.actual?.estadoAnalisis ?? 'PENDIENTE'];
              return (
                <div className="text-xs">
                  <span className={estado?.clase ?? ''}>{estado?.texto ?? '—'}</span>
                  <p className="mt-0.5 text-muted-foreground">
                    {documento.actual
                      ? (ETIQUETA_INDEXACION[documento.actual.estadoIndexacion] ??
                        documento.actual.estadoIndexacion)
                      : '—'}
                  </p>
                </div>
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
              if (documento.bloqueadoPorLitigio) {
                return documento.motivoBloqueo
                  ? `Bloqueo legal · ${documento.motivoBloqueo}`
                  : 'Bloqueo legal';
              }
              const anios = documento.tipo?.retencionAnios;
              return anios == null ? 'Sin política' : `${String(anios)} años`;
            },
          },
          {
            clave: 'acciones',
            encabezado: 'Acciones',
            celda: (documento) =>
              documento.actual ? (
                <AccionesDocumento
                  documentoId={documento.id}
                  versionId={documento.actual.id}
                  bloqueado={documento.bloqueadoPorLitigio}
                  estadoAnalisis={documento.actual.estadoAnalisis}
                  estadoIndexacion={documento.actual.estadoIndexacion}
                  puedeBloquear={puedeBloquear}
                  puedeEliminar={puedeEliminar}
                  ejecutarOcr={ejecutarOcr.bind(null, orgSlug)}
                  reanalizar={reanalizar.bind(null, orgSlug)}
                  cambiarBloqueo={cambiarBloqueo.bind(null, orgSlug)}
                  eliminar={eliminar.bind(null, orgSlug)}
                />
              ) : null,
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
