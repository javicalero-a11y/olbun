'use server';

import { z } from 'zod';

import { crearAccion } from '@/lib/actions/crear-accion';

/**
 * Litigation holds (SPEC §4.6, M9).
 *
 * A hold is what stops the retention purge — `lib/services/retencion` refuses
 * to touch a held document no matter how long its period expired. Until now it
 * could only be set by a seed, which meant the protection existed and was
 * unreachable.
 *
 * **The two directions are not the same action and do not carry the same
 * permission.** Placing a hold is protective: anybody who manages documents
 * should be able to do it the moment a dispute appears, without hunting for an
 * administrator. Lifting one exposes the document to deletion, so it takes the
 * same permission as deleting.
 *
 * A hold always carries a reason. "Why is this file untouchable" is the first
 * question anybody asks a year later, and a boolean cannot answer it.
 */

export interface EstadoBloqueo {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const bloquearSchema = z.object({
  documentoId: z.string().trim().min(1),
  motivo: z.string().trim().min(3).max(500),
});

const accionBloquear = crearAccion({
  nombre: 'documento.bloquear',
  permiso: 'documento:upload',
  esquema: bloquearSchema,
  revalidar: ['/:orgSlug/documentos', '/:orgSlug/documentos/retencion'],
  async ejecutar(datos, { db, auditar }) {
    const documento = await db.documento.findFirst({
      where: { id: datos.documentoId, deletedAt: null },
      select: { id: true, nombre: true, bloqueadoPorLitigio: true },
    });

    if (!documento) throw new Error('El documento no existe.');

    await db.documento.update({
      where: { id: documento.id },
      data: { bloqueadoPorLitigio: true },
    });

    auditar({
      tipo: 'MODIFICACION',
      accion: 'documento.bloquear',
      entidad: 'Documento',
      entidadId: documento.id,
      descripcion: `${documento.nombre} bloqueado por litigio: ${datos.motivo}`,
      antes: { bloqueadoPorLitigio: documento.bloqueadoPorLitigio },
      despues: { bloqueadoPorLitigio: true, motivo: datos.motivo },
    });

    return { nombre: documento.nombre };
  },
});

const accionDesbloquear = crearAccion({
  nombre: 'documento.desbloquear',
  // Deliberately stricter than placing the hold: lifting it is what puts the
  // document back within reach of the purge.
  permiso: 'documento:delete',
  esquema: bloquearSchema,
  revalidar: ['/:orgSlug/documentos', '/:orgSlug/documentos/retencion'],
  async ejecutar(datos, { db, auditar }) {
    const documento = await db.documento.findFirst({
      where: { id: datos.documentoId, deletedAt: null },
      select: { id: true, nombre: true, bloqueadoPorLitigio: true },
    });

    if (!documento) throw new Error('El documento no existe.');

    await db.documento.update({
      where: { id: documento.id },
      data: { bloqueadoPorLitigio: false },
    });

    auditar({
      tipo: 'MODIFICACION',
      accion: 'documento.desbloquear',
      entidad: 'Documento',
      entidadId: documento.id,
      descripcion: `${documento.nombre} desbloqueado: ${datos.motivo}`,
      antes: { bloqueadoPorLitigio: documento.bloqueadoPorLitigio },
      despues: { bloqueadoPorLitigio: false, motivo: datos.motivo },
    });

    return { nombre: documento.nombre };
  },
});

export async function cambiarBloqueo(
  orgSlug: string,
  _previo: EstadoBloqueo,
  formData: FormData,
): Promise<EstadoBloqueo> {
  const leer = (campo: string) => {
    const valor = formData.get(campo);
    return typeof valor === 'string' ? valor : '';
  };

  const bloquear = leer('bloquear') === 'true';
  const motivo = leer('motivo');

  if (motivo.trim().length < 3) {
    return {
      errores: {
        motivo: [
          bloquear
            ? 'Di por qué se bloquea: dentro de un año esa será la primera pregunta.'
            : 'Di por qué se levanta el bloqueo.',
        ],
      },
    };
  }

  const accion = bloquear ? accionBloquear : accionDesbloquear;
  const resultado = await accion(orgSlug, { documentoId: leer('documentoId'), motivo });

  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }

  return {
    exito: bloquear
      ? `«${resultado.datos.nombre}» queda bloqueado por litigio: no caduca ni se purga mientras siga así.`
      : `«${resultado.datos.nombre}» ya no está bloqueado y vuelve a contar su plazo de conservación.`,
  };
}
