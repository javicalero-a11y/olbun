import 'server-only';

import { analizarConClamAV } from '@/lib/services/antivirus';
import { extraerTextoDeArchivo } from '@/lib/services/extraccion';
import { guardarObjeto, leerObjeto } from '@/lib/storage/objetos';
import type { Prisma } from '@prisma/client';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * Documents and their versions (SPEC §4.6, M9).
 *
 * The rule the whole module is built around: **a document is never edited, it
 * gains a version.** Uploading again produces version 2 and leaves version 1
 * exactly where it was, bytes and all. Anything that can be handed to a
 * lawyer, an auditor or an inspector has to be able to answer "what did this
 * say in March", and a store that overwrites cannot.
 *
 * Deletion is soft and blocked outright while a document is under a litigation
 * hold, because the moment a dispute is live, deleting the file is the worst
 * thing the software could help somebody do.
 */

/** The seed catalogue. Spanish, because these are the names on the paperwork. */
export const TIPOS_DOCUMENTO_SEMILLA: readonly {
  codigo: string;
  nombre: string;
  retencionAnios: number | null;
  esObligatorio: boolean;
}[] = [
  { codigo: 'PLIEGO', nombre: 'Pliego (PCAP/PPT)', retencionAnios: 6, esObligatorio: true },
  { codigo: 'OFERTA', nombre: 'Oferta', retencionAnios: 6, esObligatorio: true },
  {
    codigo: 'CONTRATO_FORMALIZADO',
    nombre: 'Contrato formalizado',
    retencionAnios: 10,
    esObligatorio: true,
  },
  { codigo: 'ACTA_INICIO', nombre: 'Acta de inicio', retencionAnios: 10, esObligatorio: true },
  { codigo: 'MODIFICADO', nombre: 'Modificado', retencionAnios: 10, esObligatorio: true },
  {
    codigo: 'CERTIFICACION',
    nombre: 'Certificación mensual',
    retencionAnios: 6,
    esObligatorio: false,
  },
  { codigo: 'FACTURA', nombre: 'Factura', retencionAnios: 6, esObligatorio: true },
  { codigo: 'REQUERIMIENTO', nombre: 'Requerimiento', retencionAnios: 6, esObligatorio: false },
  { codigo: 'ALEGACIONES', nombre: 'Alegaciones', retencionAnios: 6, esObligatorio: false },
  { codigo: 'RECURSO', nombre: 'Recurso', retencionAnios: 10, esObligatorio: false },
  { codigo: 'RESOLUCION', nombre: 'Resolución', retencionAnios: 10, esObligatorio: true },
  { codigo: 'SENTENCIA', nombre: 'Sentencia', retencionAnios: null, esObligatorio: true },
  { codigo: 'POLIZA', nombre: 'Póliza', retencionAnios: 10, esObligatorio: false },
  {
    codigo: 'CERTIFICADO_ISO',
    nombre: 'Certificado ISO',
    retencionAnios: 6,
    esObligatorio: false,
  },
  {
    codigo: 'PLAN_PREVENCION',
    nombre: 'Plan de prevención',
    retencionAnios: 10,
    esObligatorio: true,
  },
  {
    codigo: 'EVALUACION_RIESGOS',
    nombre: 'Evaluación de riesgos',
    retencionAnios: 10,
    esObligatorio: true,
  },
  { codigo: 'DPIA', nombre: 'DPIA', retencionAnios: 10, esObligatorio: true },
];

/**
 * Gives a new organisation the document catalogue it starts with.
 *
 * Takes the plain transaction client rather than the tenant-scoped one: this
 * runs during sign-up, before the organisation it is seeding exists to be
 * scoped to, so `organisationId` is passed and stamped explicitly.
 */
export async function sembrarTiposDocumento(
  db: Prisma.TransactionClient,
  organisationId: string,
): Promise<number> {
  let creados = 0;

  for (const semilla of TIPOS_DOCUMENTO_SEMILLA) {
    await db.tipoDocumento.create({
      data: {
        organisationId,
        codigo: semilla.codigo,
        nombre: semilla.nombre,
        retencionAnios: semilla.retencionAnios,
        esObligatorio: semilla.esObligatorio,
        esDelSistema: true,
      },
    });
    creados += 1;
  }

  return creados;
}

export interface SubirDatos {
  nombre: string;
  contenido: Buffer;
  mimeType: string;
  descripcion?: string | undefined;
  tipoId?: string | undefined;
  contratoId?: string | undefined;
  expedienteId?: string | undefined;
  incidenciaId?: string | undefined;
  /** Adds a version to an existing document instead of creating a new one. */
  documentoId?: string | undefined;
  creadoPorId: string;
}

export interface SubirResultado {
  documentoId: string;
  versionId: string;
  numero: number;
  /** True when these exact bytes were already in the store. */
  contenidoRepetido: boolean;
  /** False when the file could not be read for the search index. */
  indexado: boolean;
  estadoAnalisis: 'LIMPIO' | 'INFECTADO' | 'NO_ANALIZADO';
  estadoIndexacion: 'EXTRAIDO' | 'OCR_PENDIENTE' | 'NO_SOPORTADO' | 'PENDIENTE' | 'ERROR';
}

/**
 * Stores a file and records it as a version.
 *
 * The bytes go to object storage before the row is written, so a failed upload
 * leaves an orphaned object rather than a database row pointing at nothing —
 * the recoverable direction. Objects are content-addressed, so the orphan is
 * reclaimed the moment anybody uploads the same file again.
 */
export async function subirDocumento(
  db: TenantTransactionClient,
  organisationId: string,
  datos: SubirDatos,
): Promise<SubirResultado> {
  const analisis = await analizarConClamAV(datos.contenido);
  const objeto = await guardarObjeto(organisationId, datos.contenido, {
    nombre: datos.nombre,
    mimeType: datos.mimeType,
  });

  const documento = datos.documentoId
    ? await db.documento.findFirst({
        where: { id: datos.documentoId, deletedAt: null },
        select: { id: true },
      })
    : null;

  if (datos.documentoId && !documento) {
    throw new Error('El documento al que se quiere añadir una versión no existe.');
  }

  const destino =
    documento ??
    (await db.documento.create({
      data: {
        organisationId,
        nombre: datos.nombre,
        descripcion: datos.descripcion ?? null,
        tipoId: datos.tipoId ?? null,
        contratoId: datos.contratoId ?? null,
        expedienteId: datos.expedienteId ?? null,
        incidenciaId: datos.incidenciaId ?? null,
        createdById: datos.creadoPorId,
      },
      select: { id: true },
    }));

  // Parsers do not touch quarantined or unscanned bytes. That is both safer and
  // truthful: searchable content means clean content was actually inspected.
  const extraido =
    analisis.estado === 'LIMPIO'
      ? await extraerTextoDeArchivo(datos.contenido, datos.mimeType, datos.nombre)
      : null;

  const estadoIndexacion = (() => {
    if (analisis.estado !== 'LIMPIO') return 'PENDIENTE' as const;
    if (extraido?.estado === 'EXTRAIDO' || extraido?.estado === 'VACIO') {
      return 'EXTRAIDO' as const;
    }
    if (
      datos.mimeType.toLowerCase() === 'application/pdf' ||
      datos.nombre.toLowerCase().endsWith('.pdf')
    ) {
      return extraido?.motivo.includes('OCR') ? ('OCR_PENDIENTE' as const) : ('ERROR' as const);
    }
    return 'NO_SOPORTADO' as const;
  })();

  const motivoIndexacion = (() => {
    if (analisis.estado === 'INFECTADO') return 'No se indexa un fichero en cuarentena.';
    if (analisis.estado === 'NO_ANALIZADO') {
      return 'Pendiente de un análisis antivirus correcto.';
    }
    return extraido?.estado === 'NO_SOPORTADO' ? extraido.motivo : null;
  })();

  // Numbered from the highest existing rather than from a count, so a purged
  // version cannot make two versions share a number.
  const ultima = await db.versionDocumento.findFirst({
    where: { documentoId: destino.id },
    select: { numero: true },
    orderBy: { numero: 'desc' },
  });

  const numero = (ultima?.numero ?? 0) + 1;

  const version = await db.versionDocumento.create({
    data: {
      organisationId,
      documentoId: destino.id,
      numero,
      nombre: datos.nombre,
      mimeType: datos.mimeType,
      tamano: objeto.tamano,
      sha256: objeto.sha256,
      storageKey: objeto.clave,
      estadoAnalisis: analisis.estado,
      analizadoEn: new Date(),
      motivoAnalisis:
        analisis.estado === 'INFECTADO'
          ? `Firma detectada: ${analisis.firma}`
          : analisis.estado === 'NO_ANALIZADO'
            ? analisis.motivo
            : null,
      textoExtraido: extraido?.estado === 'EXTRAIDO' ? extraido.texto : null,
      estadoIndexacion,
      motivoIndexacion,
      indexadoEn: estadoIndexacion === 'EXTRAIDO' ? new Date() : null,
      createdById: datos.creadoPorId,
    },
    select: { id: true },
  });

  return {
    documentoId: destino.id,
    versionId: version.id,
    numero,
    contenidoRepetido: objeto.yaExistia,
    indexado: estadoIndexacion === 'EXTRAIDO',
    estadoAnalisis: analisis.estado,
    estadoIndexacion,
  };
}

/**
 * Reads a version's bytes, checking them against the recorded hash.
 *
 * Returns the buffer rather than a signed URL on purpose: a pre-signed URL
 * leaves the object store to enforce an authorisation decision this
 * application already made, and it cannot be audited once issued. The cost is
 * that downloads pass through the server, which for the file sizes involved
 * here is a price worth paying.
 */
export async function leerVersion(
  db: TenantTransactionClient,
  versionId: string,
): Promise<{ contenido: Buffer; nombre: string; mimeType: string }> {
  const version = await db.versionDocumento.findFirst({
    where: {
      id: versionId,
      deletedAt: null,
      estadoAnalisis: 'LIMPIO',
      documento: { deletedAt: null },
    },
    select: { nombre: true, mimeType: true, sha256: true, storageKey: true },
  });

  if (!version) throw new Error('La versión no existe.');

  const contenido = await leerObjeto(version.storageKey, version.sha256);

  return { contenido, nombre: version.nombre, mimeType: version.mimeType };
}
