'use server';

import { analizarSchema, confirmarSchema, descartarSchema } from '@/lib/validation/detecciones';
import {
  analizarComunicacion,
  confirmarDeteccion,
  descartarDeteccion,
  ErrorMotor,
} from '@/lib/services/detecciones';
import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import { TIPOS_DETECCION } from '@/lib/domain/detecciones/tipos';
import { texto } from '@/lib/actions/formulario';

/**
 * Triage (SPEC §5.4).
 *
 * Every one of these is a person's decision, and every one is audited with the
 * detection's own evidence attached — which engine proposed it, how confident
 * it was, and how many of its quotes failed verification. Six months later,
 * "why was this expediente opened?" has to be answerable from the log alone.
 */

export interface EstadoDetecciones {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const RUTAS = ['/:orgSlug/detecciones', '/:orgSlug/comunicaciones'];

const accionAnalizar = crearAccion({
  nombre: 'deteccion.analizar',
  permiso: 'deteccion:review',
  esquema: analizarSchema,
  revalidar: RUTAS,
  async ejecutar(datos, { db, sesion, auditar }) {
    const resumen = await analizarComunicacion(
      db,
      sesion.organisation.id,
      datos.comunicacionId,
    );

    // Auditing an analysis is not bureaucracy: it is what ties a spend and a
    // set of proposals to the person who asked for them.
    auditar({
      tipo: 'CREACION',
      accion: 'deteccion.analizar',
      entidad: 'Comunicacion',
      entidadId: datos.comunicacionId,
      descripcion: `Análisis con ${resumen.motor}: ${String(resumen.creadas + resumen.actualizadas)} detecciones`,
      despues: {
        motor: resumen.motor,
        creadas: resumen.creadas,
        actualizadas: resumen.actualizadas,
        descartadasSinCita: resumen.descartadasSinCita,
        respetadasPorRevision: resumen.respetadasPorRevision,
        costeTokens: resumen.costeTokens ?? null,
      },
    });

    return resumen;
  },
});

export async function analizarComunicacionAccion(
  orgSlug: string,
  _previo: EstadoDetecciones,
  formData: FormData,
): Promise<EstadoDetecciones> {
  let resultado;
  try {
    resultado = await accionAnalizar(orgSlug, {
      comunicacionId: texto(formData, 'comunicacionId'),
    });
  } catch (error) {
    // The engine failing is an ordinary operational event — no credentials, the
    // API is down — and it must read as one rather than as a crashed page.
    if (error instanceof ErrorMotor) {
      return { error: `No se ha podido analizar: ${error.message}` };
    }
    throw error;
  }

  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }

  const { creadas, actualizadas, descartadasSinCita } = resultado.datos;
  const total = creadas + actualizadas;

  if (total === 0) {
    return {
      exito:
        descartadasSinCita > 0
          ? 'Sin hallazgos con cita comprobable. No se ha añadido nada a la cola.'
          : 'Analizado: nada que señalar en este mensaje.',
    };
  }

  return {
    exito: `Analizado: ${String(total)} ${total === 1 ? 'detección' : 'detecciones'} en la cola.`,
  };
}

const accionConfirmar = crearAccion({
  nombre: 'deteccion.confirmar',
  permiso: 'deteccion:review',
  esquema: confirmarSchema,
  revalidar: [...RUTAS, '/:orgSlug/expedientes', '/:orgSlug/plazos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const deteccion = await db.deteccion.findFirst({
      where: { id: datos.deteccionId, deletedAt: null },
      select: {
        tipo: true,
        estado: true,
        confianza: true,
        confianzaModelo: true,
        extractosDescartados: true,
        modelId: true,
        promptVersion: true,
      },
    });

    if (!deteccion) throw new ErrorDeCampo('deteccionId', 'Esa detección ya no existe.');
    if (deteccion.estado === 'CONVERTIDA') {
      throw new ErrorDeCampo('deteccionId', 'Esta detección ya abrió un expediente.');
    }

    const resultado = await confirmarDeteccion(db, sesion.organisation.id, {
      deteccionId: datos.deteccionId,
      revisorId: sesion.user.id,
      fechaApertura: datos.fechaApertura,
      titulo: datos.titulo,
    });

    const evidencia = {
      tipo: deteccion.tipo,
      // Both numbers: the gap between them is how a reviewer's trust in the
      // engine should be calibrated after the fact.
      confianza: deteccion.confianza,
      confianzaModelo: deteccion.confianzaModelo,
      citasDescartadas: deteccion.extractosDescartados,
      modelId: deteccion.modelId,
      promptVersion: deteccion.promptVersion,
    };

    auditar({
      tipo: 'MODIFICACION',
      accion: 'deteccion.confirmar',
      entidad: 'Deteccion',
      entidadId: datos.deteccionId,
      descripcion: `Confirmada: ${TIPOS_DETECCION[deteccion.tipo].etiqueta}`,
      despues: { ...evidencia, resultado },
    });

    // Whatever the confirmation created is audited as its own creation, with
    // the detection's evidence attached: the record has to be able to show
    // which sentence in which letter a person acted on.
    if (resultado.destino === 'EXPEDIENTE') {
      auditar({
        tipo: 'CREACION',
        accion: 'expediente.abrir',
        entidad: 'Expediente',
        entidadId: resultado.expedienteId,
        descripcion: `${resultado.referencia} — abierto desde una detección confirmada`,
        despues: {
          referencia: resultado.referencia,
          hitos: resultado.hitos,
          plazos: resultado.plazos,
          origenDeteccionId: datos.deteccionId,
          ...evidencia,
        },
      });
    }

    if (resultado.destino === 'INCIDENCIA' || resultado.destino === 'RIESGO') {
      auditar({
        tipo: 'CREACION',
        accion: resultado.destino === 'INCIDENCIA' ? 'incidencia.crear' : 'riesgo.crear',
        entidad: resultado.destino === 'INCIDENCIA' ? 'Incidencia' : 'Riesgo',
        entidadId: resultado.registroId,
        descripcion: `${resultado.referencia} — creado desde una detección confirmada`,
        despues: {
          referencia: resultado.referencia,
          origenDeteccionId: datos.deteccionId,
          ...evidencia,
        },
      });
    }

    return resultado;
  },
});

export async function confirmar(
  orgSlug: string,
  _previo: EstadoDetecciones,
  formData: FormData,
): Promise<EstadoDetecciones> {
  const resultado = await accionConfirmar(orgSlug, {
    deteccionId: texto(formData, 'deteccionId'),
    fechaApertura: texto(formData, 'fechaApertura'),
    titulo: texto(formData, 'titulo'),
  });

  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }

  if (resultado.datos.destino === 'EXPEDIENTE') {
    const { referencia, plazos } = resultado.datos;
    return {
      exito:
        plazos > 0
          ? `Expediente ${referencia} abierto, con ${String(plazos)} ${plazos === 1 ? 'plazo' : 'plazos'} por confirmar.`
          : `Expediente ${referencia} abierto. No tenía plantilla, así que no tiene hitos todavía.`,
    };
  }

  if (resultado.datos.destino === 'INCIDENCIA') {
    return { exito: `Incidencia ${resultado.datos.referencia} registrada.` };
  }

  if (resultado.datos.destino === 'RIESGO') {
    return {
      exito: `Riesgo ${resultado.datos.referencia} añadido al registro, pendiente de valorar.`,
    };
  }

  // Only PLAZO_MENCIONADO reaches here, and it creates nothing on purpose: a
  // date in a letter is not a plazo until somebody checks what it rests on.
  return {
    exito: 'Confirmada. Comprueba el fundamento antes de llevar el plazo a un expediente.',
  };
}

const accionDescartar = crearAccion({
  nombre: 'deteccion.descartar',
  permiso: 'deteccion:review',
  esquema: descartarSchema,
  revalidar: RUTAS,
  async ejecutar(datos, { db, sesion, auditar }) {
    const resultado = await descartarDeteccion(db, {
      deteccionId: datos.deteccionId,
      revisorId: sesion.user.id,
      motivo: datos.motivo,
    });

    auditar({
      tipo: 'MODIFICACION',
      accion: 'deteccion.descartar',
      entidad: 'Deteccion',
      entidadId: datos.deteccionId,
      descripcion: `Descartada: ${resultado.tipo}`,
      // The reason is the point of the record — it is what a later prompt
      // review reads.
      despues: { tipo: resultado.tipo, motivo: datos.motivo },
    });

    return resultado;
  },
});

export async function descartar(
  orgSlug: string,
  _previo: EstadoDetecciones,
  formData: FormData,
): Promise<EstadoDetecciones> {
  const resultado = await accionDescartar(orgSlug, {
    deteccionId: texto(formData, 'deteccionId'),
    motivo: texto(formData, 'motivo'),
  });

  if (!resultado.ok) {
    return resultado.errores ? { errores: resultado.errores } : { error: resultado.error };
  }

  return { exito: 'Descartada. No volverá a aparecer aunque se reanalice el mensaje.' };
}
