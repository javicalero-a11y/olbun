import 'server-only';

import { registrarEvento, type ContextoAuditoria } from '@/lib/audit/registrar';
import { tenantClient, tenantTransaction } from '@/lib/db/tenant';
import { analizarConClamAV } from '@/lib/services/antivirus';
import { esPdf, extraerTextoDeArchivo } from '@/lib/services/extraccion';
import { leerObjeto } from '@/lib/storage/objetos';

/** Re-runs antivirus and safe extraction for one stored version. */
export async function reanalizarVersion(
  organisationId: string,
  versionId: string,
  actor: Pick<ContextoAuditoria, 'actorId' | 'actorEmail' | 'actorRol'>,
): Promise<{
  documentoId: string;
  estadoAnalisis: 'LIMPIO' | 'INFECTADO' | 'NO_ANALIZADO';
  estadoIndexacion: string;
}> {
  const db = tenantClient(organisationId);
  const version = await db.versionDocumento.findFirst({
    where: { id: versionId, deletedAt: null, documento: { deletedAt: null } },
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

  const contenido = await leerObjeto(version.storageKey, version.sha256);
  const analisis = await analizarConClamAV(contenido);
  const extraido =
    analisis.estado === 'LIMPIO'
      ? await extraerTextoDeArchivo(contenido, version.mimeType, version.nombre)
      : null;

  const estadoIndexacion = (() => {
    if (analisis.estado !== 'LIMPIO') return 'PENDIENTE' as const;
    if (extraido?.estado === 'EXTRAIDO' || extraido?.estado === 'VACIO') {
      return 'EXTRAIDO' as const;
    }
    if (esPdf(version.mimeType, version.nombre)) {
      return extraido?.motivo.includes('OCR') ? ('OCR_PENDIENTE' as const) : ('ERROR' as const);
    }
    return 'NO_SOPORTADO' as const;
  })();

  await tenantTransaction(organisationId, async (tx) => {
    await tx.versionDocumento.update({
      where: { id: version.id },
      data: {
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
        motivoIndexacion:
          analisis.estado !== 'LIMPIO'
            ? 'Pendiente de un análisis antivirus correcto.'
            : extraido?.estado === 'NO_SOPORTADO'
              ? extraido.motivo
              : null,
        indexadoEn: estadoIndexacion === 'EXTRAIDO' ? new Date() : null,
      },
    });
    await registrarEvento(
      tx,
      { organisationId, ...actor },
      {
        tipo: 'MODIFICACION',
        accion: 'documento.reanalizar',
        entidad: 'VersionDocumento',
        entidadId: version.id,
        descripcion: version.nombre,
        antes: { estadoAnalisis: version.estadoAnalisis },
        despues: { estadoAnalisis: analisis.estado, estadoIndexacion },
      },
    );
  });

  return {
    documentoId: version.documentoId,
    estadoAnalisis: analisis.estado,
    estadoIndexacion,
  };
}
