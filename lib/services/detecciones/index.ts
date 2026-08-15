import 'server-only';

import { TIPOS_DETECCION } from '@/lib/domain/detecciones/tipos';
import { verificarExtractos } from '@/lib/domain/detecciones/verificacion';
import { abrirExpediente, aDate } from '@/lib/services/expedientes';
import { categoriaRiesgoPorClave, crearIncidencia, crearRiesgo } from '@/lib/services/riesgos';
import { hayClaveDeClaude, motorClaude } from './claude';
import { resumenDesdeExtractos } from './extractos';
import { logger } from '@/lib/logger';
import { motorDeReglas } from './reglas';
import { serverEnv } from '@/lib/env';
import { textoFuenteDe } from './motor';
import type { EntradaAnalisis, MotorDeteccion } from './motor';
import type { FechaCivil } from '@/lib/domain/fecha';
import type { Prisma } from '@prisma/client';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { resumenDeDatos } from './sistema';

/**
 * Turning proposals into a reviewable queue (SPEC §4.4, §5.4, §6.4).
 *
 * Everything an engine says passes through here, and three rules hold no
 * matter which engine spoke:
 *
 *  1. **Every quote is verified against the source before it is stored.** A
 *     detection whose quotes all fail is recorded as automatically discarded,
 *     never shown as a finding — and kept, because a prompt that invents
 *     quotes is something you want to be able to measure.
 *  2. **A person's decision is never undone by a machine.** Re-analysing a
 *     message refreshes what is still pending and leaves anything a human
 *     confirmed or discarded exactly as they left it.
 *  3. **Nothing here acts.** Confirmation is a separate call, made by a person,
 *     and it is the only path that opens an expediente.
 */

export { ErrorMotor } from './motor';
export { descartarDeteccion } from './descartar';
export type { MotorDeteccion } from './motor';

/**
 * Claude when configured, the local rule engine otherwise.
 *
 * A machine without an API key gets a working, honest, weaker product rather
 * than a broken one — and every detection records which of the two produced
 * it, so nobody has to guess.
 *
 * `MOTOR_DETECCION` overrides the choice either way. The end-to-end suite pins
 * it to `reglas`, because a test run must not depend on a network call and
 * must not start spending money the day somebody adds a key to their `.env`.
 */
export function motorPorDefecto(): MotorDeteccion {
  const forzado = serverEnv().MOTOR_DETECCION;

  if (forzado === 'reglas') return motorDeReglas();
  if (forzado === 'claude') return motorClaude();

  return hayClaveDeClaude() ? motorClaude() : motorDeReglas();
}

export interface ResumenAnalisis {
  motor: string;
  creadas: number;
  actualizadas: number;
  /** Proposals with no quote that survived verification (SPEC §6.4). */
  descartadasSinCita: number;
  /** Types a person had already ruled on, left untouched. */
  respetadasPorRevision: number;
  costeTokens: number | undefined;
}

interface ExistentePorTipo {
  id: string;
  estado: string;
  revisadaPorId: string | null;
}

/**
 * Runs the engine over one message and files what it proposes.
 *
 * The source text is built once and used both to prompt the engine and to
 * verify its quotes, so a quote can never fail because the two differed.
 */
export async function analizarComunicacion(
  db: TenantTransactionClient,
  organisationId: string,
  comunicacionId: string,
  motor: MotorDeteccion = motorPorDefecto(),
): Promise<ResumenAnalisis> {
  const comunicacion = await db.comunicacion.findFirst({
    where: { id: comunicacionId, deletedAt: null },
    select: {
      id: true,
      asunto: true,
      de: true,
      fechaEnvio: true,
      fechaRecepcion: true,
      cuerpoTexto: true,
    },
  });

  if (!comunicacion) {
    throw new Error('La comunicación no existe.');
  }

  const entrada: EntradaAnalisis = {
    asunto: comunicacion.asunto,
    de: comunicacion.de,
    fecha: comunicacion.fechaEnvio ?? comunicacion.fechaRecepcion,
    cuerpo: comunicacion.cuerpoTexto ?? '',
  };

  const resultado = await motor.analizar(entrada);
  const textoFuente = textoFuenteDe(entrada);

  const previas = await db.deteccion.findMany({
    where: { comunicacionId, deletedAt: null },
    select: { id: true, tipo: true, estado: true, revisadaPorId: true },
  });

  const porTipo = new Map<string, ExistentePorTipo>(
    previas.map((previa) => [
      previa.tipo,
      { id: previa.id, estado: previa.estado, revisadaPorId: previa.revisadaPorId },
    ]),
  );

  const resumen: ResumenAnalisis = {
    motor: resultado.modelId,
    creadas: 0,
    actualizadas: 0,
    descartadasSinCita: 0,
    respetadasPorRevision: 0,
    costeTokens: resultado.costeTokens,
  };

  for (const propuesta of resultado.propuestas) {
    const existente = porTipo.get(propuesta.tipo);

    // A person's decision outranks a re-run. An automatic discard does not —
    // it has no reviewer, so a better engine is allowed to replace it.
    if (existente && existente.revisadaPorId !== null) {
      resumen.respetadasPorRevision += 1;
      continue;
    }

    const verificado = verificarExtractos(
      textoFuente,
      propuesta.extractos,
      propuesta.confianza,
    );

    if (verificado.sinRespaldo) {
      logger.warn(
        {
          comunicacionId,
          tipo: propuesta.tipo,
          modelId: resultado.modelId,
          promptVersion: resultado.promptVersion,
          descartados: verificado.descartados.length,
        },
        'Detección sin ninguna cita verificable: descartada automáticamente',
      );
      resumen.descartadasSinCita += 1;
    }

    const datos = {
      tipo: propuesta.tipo,
      confianza: verificado.confianza,
      confianzaModelo: Math.min(1, Math.max(0, propuesta.confianza)),
      extractosDescartados: verificado.descartados.length,
      extractos: verificado.extractos as unknown as Prisma.InputJsonValue,
      datosExtraidos: propuesta.datos ? (propuesta.datos as Prisma.InputJsonValue) : undefined,
      // Recorded rather than dropped: this is the material for the prompt
      // review the spec asks for.
      estado: verificado.sinRespaldo ? ('DESCARTADA' as const) : ('NUEVA' as const),
      motivoDescarte: verificado.sinRespaldo
        ? 'Automático: ninguna cita coincidía con el texto del documento.'
        : null,
      modelId: resultado.modelId,
      promptVersion: resultado.promptVersion,
      costeTokens: resultado.costeTokens ?? null,
    };

    if (existente) {
      await db.deteccion.update({ where: { id: existente.id }, data: datos });
      resumen.actualizadas += 1;
      continue;
    }

    await db.deteccion.create({
      data: { organisationId, comunicacionId, ...datos },
    });
    resumen.creadas += 1;
  }

  return resumen;
}

export interface ConfirmarDatos {
  deteccionId: string;
  revisorId: string;
  /**
   * The event that starts the clock. Required rather than derived: a date
   * lifted from an email is a guess, and every deadline in the resulting
   * expediente is computed from this one (SPEC §2, §6.4).
   */
  fechaApertura: FechaCivil;
  titulo?: string | undefined;
}

/**
 * Every variant carries `destino`, so a caller narrows on one field rather
 * than guessing which shape a `CONVERTIDA` happens to be.
 */
export type ResultadoConfirmacion =
  | {
      estado: 'CONVERTIDA';
      destino: 'EXPEDIENTE';
      expedienteId: string;
      referencia: string;
      hitos: number;
      plazos: number;
    }
  /** Became an incidencia or a riesgo, which have no timeline of their own. */
  | {
      estado: 'CONVERTIDA';
      destino: 'INCIDENCIA' | 'RIESGO';
      registroId: string;
      referencia: string;
    }
  /** Agreed with, but there is nothing this type creates. */
  | { estado: 'CONFIRMADA'; destino: 'NINGUNO' };

/**
 * A person says yes.
 *
 * For the types that map to one, this opens an expediente from its procedure
 * template — the whole timeline of hitos and plazos, computed by the engine in
 * `lib/domain/expedientes`, from the date the reviewer supplied. The detection
 * keeps a link to what it produced, so the expediente can always be traced
 * back to the sentence in the letter that caused it.
 */
export async function confirmarDeteccion(
  db: TenantTransactionClient,
  organisationId: string,
  datos: ConfirmarDatos,
): Promise<ResultadoConfirmacion> {
  const deteccion = await db.deteccion.findFirst({
    where: { id: datos.deteccionId, deletedAt: null },
    select: {
      id: true,
      tipo: true,
      estado: true,
      extractos: true,
      origen: true,
      contratoId: true,
      datosExtraidos: true,
      comunicacion: {
        select: { id: true, asunto: true, contratoId: true, expedienteId: true },
      },
    },
  });

  if (!deteccion) throw new Error('La detección no existe.');
  if (deteccion.estado === 'CONVERTIDA') {
    throw new Error('Esta detección ya se convirtió en expediente.');
  }

  const definicion = TIPOS_DETECCION[deteccion.tipo];
  const revisada = { revisadaPorId: datos.revisorId, revisadaEn: new Date() };
  const plantillaExpediente = definicion.expediente;

  const cita = resumenDesdeExtractos(deteccion.extractos);

  // Las detecciones de sistema no tienen mensaje del que colgar. Su asunto es
  // lo que el propio motor calculó y su contrato viene en la fila, no a través
  // de una comunicación.
  const asunto = deteccion.comunicacion?.asunto ?? definicion.etiqueta;
  const contratoId = deteccion.comunicacion?.contratoId ?? deteccion.contratoId ?? undefined;
  const resumenDeSistema = resumenDeDatos(deteccion.datosExtraidos);

  /** Marks the source message reviewed, when there is one to mark. */
  const cerrarOrigen = async () => {
    if (deteccion.comunicacion) await marcarRevisada(db, deteccion.comunicacion.id);
  };

  // An incidencia: something that already happened, and whose date is the day
  // the message reporting it was sent — the reviewer confirmed that reading.
  if (definicion.destino === 'INCIDENCIA') {
    const incidencia = await crearIncidencia(db, organisationId, {
      tipo: definicion.incidencia?.tipo ?? 'FALLO_SERVICIO',
      gravedad: definicion.incidencia?.gravedad ?? 'MODERADA',
      fechaHecho: aDate(datos.fechaApertura),
      descripcion: cita ?? resumenDeSistema ?? `${definicion.etiqueta} — ${asunto}`,
      contratoId,
      deteccionId: deteccion.id,
      creadoPorId: datos.revisorId,
    });

    await db.deteccion.update({
      where: { id: deteccion.id },
      data: { estado: 'CONVERTIDA', ...revisada },
    });
    await cerrarOrigen();

    return {
      estado: 'CONVERTIDA',
      destino: 'INCIDENCIA',
      registroId: incidencia.id,
      referencia: incidencia.referencia,
    };
  }

  // A riesgo: something that has not happened. It is deliberately created
  // unscored beyond a placeholder — the engine has no basis for a probability,
  // and a register full of machine-invented scores is worse than an empty one.
  if (definicion.destino === 'RIESGO') {
    const categoria = await categoriaRiesgoPorClave(
      db,
      definicion.riesgo?.categoria ?? 'OPERATIVO',
    );
    const riesgo = await crearRiesgo(db, organisationId, {
      categoriaId: categoria.id,
      causa:
        deteccion.origen === 'SISTEMA'
          ? `Detectado por el motor sobre los datos del sistema`
          : `Detectado en «${asunto}»`,
      evento: definicion.etiqueta,
      consecuencia: cita ?? resumenDeSistema ?? definicion.descripcion,
      // The midpoint of the matrix, and the reason the register shows every
      // risk born this way as pending assessment.
      probabilidadInherente: 3,
      impactoInherente: 3,
      contratoId,
      deteccionId: deteccion.id,
      creadoPorId: datos.revisorId,
    });

    await db.deteccion.update({
      where: { id: deteccion.id },
      data: { estado: 'CONVERTIDA', ...revisada },
    });
    await cerrarOrigen();

    return {
      estado: 'CONVERTIDA',
      destino: 'RIESGO',
      registroId: riesgo.id,
      referencia: riesgo.referencia,
    };
  }

  // Nothing to create — a mentioned deadline is agreed with and left for a
  // person to place, because a date in a letter is not a plazo (SPEC §6.4).
  if (!plantillaExpediente) {
    await db.deteccion.update({
      where: { id: deteccion.id },
      data: { estado: 'CONFIRMADA', ...revisada },
    });
    await cerrarOrigen();

    return { estado: 'CONFIRMADA', destino: 'NINGUNO' };
  }

  // The tenant's own template for this kind of procedure, if they have one.
  // Without it the expediente opens with no timeline, which is worse but still
  // better than refusing to open it.
  const plantilla = await db.plantillaProcedimiento.findFirst({
    where: { tipo: plantillaExpediente.tipo, deletedAt: null },
    select: { id: true },
    orderBy: { esDelSistema: 'asc' },
  });

  const expediente = await abrirExpediente(db, organisationId, {
    titulo: datos.titulo?.trim() || `${definicion.etiqueta} — ${asunto}`,
    tipo: plantillaExpediente.tipo,
    jurisdiccion: plantillaExpediente.jurisdiccion,
    contratoId,
    plantillaId: plantilla?.id,
    fechaApertura: datos.fechaApertura,
    resumen: resumenDesdeExtractos(deteccion.extractos),
    creadoPorId: datos.revisorId,
  });

  await db.deteccion.update({
    where: { id: deteccion.id },
    data: { estado: 'CONVERTIDA', expedienteId: expediente.expedienteId, ...revisada },
  });

  // The message is filed against the expediente it produced, so the letter and
  // the case are one click apart in both directions.
  if (deteccion.comunicacion && !deteccion.comunicacion.expedienteId) {
    await db.comunicacion.update({
      where: { id: deteccion.comunicacion.id },
      data: { expedienteId: expediente.expedienteId, estadoRevision: 'REVISADA' },
    });
  } else {
    await cerrarOrigen();
  }

  return {
    estado: 'CONVERTIDA',
    destino: 'EXPEDIENTE',
    expedienteId: expediente.expedienteId,
    referencia: expediente.referencia,
    hitos: expediente.hitosCreados,
    plazos: expediente.plazosCreados,
  };
}

async function marcarRevisada(
  db: TenantTransactionClient,
  comunicacionId: string,
): Promise<void> {
  await db.comunicacion.update({
    where: { id: comunicacionId },
    data: { estadoRevision: 'REVISADA' },
  });
}
