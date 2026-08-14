import 'server-only';

import datosEspanol from '@tesseract.js-data/spa';

import { registrarEvento, type ContextoAuditoria } from '@/lib/audit/registrar';
import { tenantClient, tenantTransaction } from '@/lib/db/tenant';
import { MAXIMO_CARACTERES } from '@/lib/domain/documentos/texto';
import { serverEnv } from '@/lib/env';
import { logger } from '@/lib/logger';
import { leerObjeto } from '@/lib/storage/objetos';

export interface ResultadoOcr {
  texto: string;
  paginasProcesadas: number;
  paginasTotales: number;
  confianza: number | null;
  completo: boolean;
}

/** Renders PDF pages and recognises them locally with the Spanish model. */
export async function reconocerPdf(
  contenido: Buffer,
  maximoPaginas: number = serverEnv().OCR_MAX_PAGES,
): Promise<ResultadoOcr> {
  const [{ createWorker }, { getDocumentProxy, renderPageAsImage }] = await Promise.all([
    import('tesseract.js'),
    import('unpdf'),
  ]);
  const documento = await getDocumentProxy(new Uint8Array(contenido));
  const paginasTotales = documento.numPages;
  const paginasProcesadas = Math.min(paginasTotales, maximoPaginas);
  const worker = await createWorker('spa', undefined, {
    langPath: datosEspanol.langPath,
    gzip: datosEspanol.gzip,
    // The language model is vendored. Do not copy another 17 MB cache into
    // whichever directory happened to launch the worker.
    cacheMethod: 'none',
    logger: (avance) => {
      if (avance.status === 'recognizing text' && avance.progress === 1) {
        logger.debug('Página OCR completada');
      }
    },
  });
  const textos: string[] = [];
  const confianzas: number[] = [];

  try {
    for (let pagina = 1; pagina <= paginasProcesadas; pagina += 1) {
      const imagen = await renderPageAsImage(documento, pagina, {
        scale: 1.75,
        canvasImport: () => import('@napi-rs/canvas'),
      });
      const resultado = await worker.recognize(Buffer.from(imagen));
      const texto = resultado.data.text.replace(/[ \t]+/g, ' ').trim();
      if (texto) textos.push(texto);
      if (Number.isFinite(resultado.data.confidence)) {
        confianzas.push(resultado.data.confidence);
      }
    }
  } finally {
    await worker.terminate();
    await documento.cleanup();
  }

  return {
    texto: textos.join('\n\n').slice(0, MAXIMO_CARACTERES),
    paginasProcesadas,
    paginasTotales,
    confianza:
      confianzas.length === 0
        ? null
        : confianzas.reduce((suma, valor) => suma + valor, 0) / confianzas.length,
    completo: paginasProcesadas === paginasTotales,
  };
}

export interface ResultadoProcesoOcr extends ResultadoOcr {
  estado: 'OCR_COMPLETADO' | 'OCR_PARCIAL';
  documentoId: string;
}

/**
 * Runs the expensive part outside a transaction, then commits state and audit
 * atomically. Keeping a transaction open while Tesseract reads thirty pages
 * would exhaust the database pool under normal use.
 */
export async function procesarOcrVersion(
  organisationId: string,
  versionId: string,
  actor: Pick<ContextoAuditoria, 'actorId' | 'actorEmail' | 'actorRol'>,
): Promise<ResultadoProcesoOcr> {
  const db = tenantClient(organisationId);
  const version = await db.versionDocumento.findFirst({
    where: {
      id: versionId,
      deletedAt: null,
      documento: { deletedAt: null },
    },
    select: {
      id: true,
      documentoId: true,
      nombre: true,
      mimeType: true,
      storageKey: true,
      sha256: true,
      estadoAnalisis: true,
    },
  });

  if (!version) throw new Error('La versión no existe.');
  if (version.estadoAnalisis !== 'LIMPIO') {
    throw new Error('Solo se puede ejecutar OCR después de un análisis antivirus limpio.');
  }
  if (
    version.mimeType !== 'application/pdf' &&
    !version.nombre.toLowerCase().endsWith('.pdf')
  ) {
    throw new Error('El OCR de M9 admite documentos PDF escaneados.');
  }

  const contenido = await leerObjeto(version.storageKey, version.sha256);
  let resultado: ResultadoOcr;

  try {
    resultado = await reconocerPdf(contenido);
  } catch (error) {
    const motivo = error instanceof Error ? error.message : 'Error OCR desconocido.';
    await tenantTransaction(organisationId, async (tx) => {
      await tx.versionDocumento.update({
        where: { id: version.id },
        data: { estadoIndexacion: 'ERROR', motivoIndexacion: motivo, indexadoEn: new Date() },
      });
      await registrarEvento(
        tx,
        { organisationId, ...actor },
        {
          tipo: 'MODIFICACION',
          accion: 'documento.ocr_error',
          entidad: 'VersionDocumento',
          entidadId: version.id,
          descripcion: version.nombre,
          despues: { estadoIndexacion: 'ERROR', motivo },
        },
      );
    });
    throw new Error('No se ha podido leer el PDF escaneado. El error queda registrado.');
  }

  const estado = resultado.completo ? 'OCR_COMPLETADO' : 'OCR_PARCIAL';
  const motivo = resultado.completo
    ? null
    : `Se han procesado ${String(resultado.paginasProcesadas)} de ${String(resultado.paginasTotales)} páginas por el límite configurado.`;

  await tenantTransaction(organisationId, async (tx) => {
    await tx.versionDocumento.update({
      where: { id: version.id },
      data: {
        textoExtraido: resultado.texto,
        estadoIndexacion: estado,
        motivoIndexacion: motivo,
        indexadoEn: new Date(),
        ocrPaginas: resultado.paginasProcesadas,
        ocrConfianza: resultado.confianza,
      },
    });
    await registrarEvento(
      tx,
      { organisationId, ...actor },
      {
        tipo: 'MODIFICACION',
        accion: 'documento.ocr',
        entidad: 'VersionDocumento',
        entidadId: version.id,
        descripcion: version.nombre,
        despues: {
          estadoIndexacion: estado,
          paginasProcesadas: resultado.paginasProcesadas,
          paginasTotales: resultado.paginasTotales,
          confianza: resultado.confianza,
        },
      },
    );
  });

  return { ...resultado, estado, documentoId: version.documentoId };
}
