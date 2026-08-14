import 'server-only';

import type { Prisma } from '@prisma/client';

import type { TenantTransactionClient } from '@/lib/db/tenant';
import { hoyEn } from '@/lib/domain/fecha';
import {
  erroresCambioAccion,
  erroresCierreIncidencia,
  erroresValoracionResidual,
  puedeCambiarIncidencia,
  type EstadoAccionCorrectora,
} from '@/lib/domain/riesgos/ciclo';
import { valorar, valorarResidual, type Escala } from '@/lib/domain/riesgos/matriz';
import { cargarBandasRiesgo } from '@/lib/services/riesgos';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';

function aDate(fecha: string): Date {
  return new Date(`${fecha}T00:00:00.000Z`);
}

function hoyDate(): Date {
  return aDate(hoyEn('Europe/Madrid'));
}

async function validarResponsable(
  db: TenantTransactionClient,
  responsableId: string | undefined,
): Promise<void> {
  if (!responsableId) return;
  const existe = await db.membership.findFirst({
    where: { userId: responsableId, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!existe)
    throw new ErrorDeCampo('responsableId', 'La persona responsable ya no está activa.');
}

export interface RevisarRiesgoDatos {
  riesgoId: string;
  resultado: 'SIN_CAMBIOS' | 'REVALORADO' | 'CONTROL_ACTUALIZADO' | 'CERRADO';
  comentarios: string;
  probabilidadResidual?: number | undefined;
  impactoResidual?: number | undefined;
  proximaRevision?: string | undefined;
  revisadaPorId: string;
}

export async function revisarRiesgo(
  db: TenantTransactionClient,
  organisationId: string,
  datos: RevisarRiesgoDatos,
): Promise<{ referencia: string; estado: string; revalorado: boolean }> {
  const riesgo = await db.riesgo.findFirst({
    where: { id: datos.riesgoId, deletedAt: null },
    select: {
      id: true,
      referencia: true,
      estado: true,
      probabilidadInherente: true,
      impactoInherente: true,
      probabilidadResidual: true,
      impactoResidual: true,
    },
  });
  if (!riesgo) throw new ErrorDeCampo('riesgoId', 'Ese riesgo ya no existe.');
  if (riesgo.estado === 'MATERIALIZADO') {
    throw new ErrorDeCampo(
      'riesgoId',
      'El riesgo ya se materializó; gestiona la incidencia vinculada.',
    );
  }

  const bandas = await cargarBandasRiesgo(db);
  const inherente = valorar(
    riesgo.probabilidadInherente as Escala,
    riesgo.impactoInherente as Escala,
    bandas,
  );
  const residualNuevo = valorarResidual(
    datos.probabilidadResidual,
    datos.impactoResidual,
    bandas,
  );
  if (residualNuevo) {
    const errores = erroresValoracionResidual(inherente, residualNuevo, datos.comentarios);
    if (errores[0]) throw new ErrorDeCampo('comentarios', errores[0]);
  }

  const residualCambio =
    residualNuevo !== null &&
    (riesgo.probabilidadResidual !== residualNuevo.probabilidad ||
      riesgo.impactoResidual !== residualNuevo.impacto);
  const cerrada = datos.resultado === 'CERRADO';
  if (!cerrada && !datos.proximaRevision) {
    throw new ErrorDeCampo('proximaRevision', 'Programa la siguiente revisión.');
  }
  if (residualCambio && datos.resultado !== 'REVALORADO') {
    throw new ErrorDeCampo(
      'resultado',
      'Indica que el resultado de la revisión es «Revalorado».',
    );
  }
  const estado = cerrada
    ? 'CERRADO'
    : riesgo.estado === 'IDENTIFICADO'
      ? 'EN_TRATAMIENTO'
      : riesgo.estado;

  await db.riesgo.update({
    where: { id: riesgo.id },
    data: {
      estado,
      ultimaRevision: hoyDate(),
      proximaRevision: cerrada ? null : aDate(datos.proximaRevision ?? ''),
      ...(residualNuevo
        ? {
            probabilidadResidual: residualNuevo.probabilidad,
            impactoResidual: residualNuevo.impacto,
          }
        : {}),
    },
  });

  await db.revisionRiesgo.create({
    data: {
      organisationId,
      riesgoId: riesgo.id,
      resultado: datos.resultado,
      comentarios: datos.comentarios,
      revisadaPorId: datos.revisadaPorId,
      proximaRevision: cerrada ? null : aDate(datos.proximaRevision ?? ''),
      createdById: datos.revisadaPorId,
    },
  });

  if (residualCambio && residualNuevo) {
    await db.valoracionRiesgo.create({
      data: {
        organisationId,
        riesgoId: riesgo.id,
        tipo: 'REVISION',
        probabilidadInherente: inherente.probabilidad,
        impactoInherente: inherente.impacto,
        puntuacionInherente: inherente.puntuacion,
        nivelInherente: inherente.nivel,
        probabilidadResidual: residualNuevo.probabilidad,
        impactoResidual: residualNuevo.impacto,
        puntuacionResidual: residualNuevo.puntuacion,
        nivelResidual: residualNuevo.nivel,
        justificacion: datos.comentarios,
        bandas: bandas.map((banda) => ({ ...banda })) as Prisma.InputJsonValue,
        valoradaPorId: datos.revisadaPorId,
        createdById: datos.revisadaPorId,
      },
    });
  }

  return { referencia: riesgo.referencia, estado, revalorado: residualCambio };
}

export interface CrearControlDatos {
  riesgoId: string;
  titulo: string;
  descripcion: string;
  tipo: 'PREVENTIVO' | 'DETECTIVO' | 'CORRECTIVO' | 'DIRECTIVO';
  eficacia: 'NO_EVALUADO' | 'INEFICAZ' | 'PARCIAL' | 'EFICAZ';
  esExistente: boolean;
  responsableId?: string | undefined;
  ultimaPrueba?: string | undefined;
  proximaPrueba?: string | undefined;
  creadoPorId: string;
}

export async function crearControlRiesgo(
  db: TenantTransactionClient,
  organisationId: string,
  datos: CrearControlDatos,
): Promise<{ id: string; titulo: string }> {
  const riesgo = await db.riesgo.findFirst({
    where: { id: datos.riesgoId, deletedAt: null },
    select: { id: true, estado: true },
  });
  if (!riesgo) throw new ErrorDeCampo('riesgoId', 'Ese riesgo ya no existe.');
  await validarResponsable(db, datos.responsableId);

  const control = await db.controlRiesgo.create({
    data: {
      organisationId,
      riesgoId: riesgo.id,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      tipo: datos.tipo,
      eficacia: datos.eficacia,
      esExistente: datos.esExistente,
      responsableId: datos.responsableId ?? null,
      ultimaPrueba: datos.ultimaPrueba ? aDate(datos.ultimaPrueba) : null,
      proximaPrueba: datos.proximaPrueba ? aDate(datos.proximaPrueba) : null,
      createdById: datos.creadoPorId,
    },
    select: { id: true, titulo: true },
  });

  if (riesgo.estado === 'IDENTIFICADO') {
    await db.riesgo.update({ where: { id: riesgo.id }, data: { estado: 'EN_TRATAMIENTO' } });
  }
  return control;
}

export interface CrearAccionDatos {
  riesgoId?: string | undefined;
  incidenciaId?: string | undefined;
  titulo: string;
  descripcion: string;
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  responsableId?: string | undefined;
  fechaLimite?: string | undefined;
  creadoPorId: string;
}

export async function crearAccionCorrectora(
  db: TenantTransactionClient,
  organisationId: string,
  datos: CrearAccionDatos,
): Promise<{ id: string; titulo: string }> {
  const [riesgo, incidencia] = await Promise.all([
    datos.riesgoId
      ? db.riesgo.findFirst({
          where: { id: datos.riesgoId, deletedAt: null },
          select: { id: true },
        })
      : null,
    datos.incidenciaId
      ? db.incidencia.findFirst({
          where: { id: datos.incidenciaId, deletedAt: null },
          select: { id: true },
        })
      : null,
  ]);
  if (datos.riesgoId && !riesgo) throw new ErrorDeCampo('riesgoId', 'Ese riesgo ya no existe.');
  if (datos.incidenciaId && !incidencia) {
    throw new ErrorDeCampo('incidenciaId', 'Esa incidencia ya no existe.');
  }
  await validarResponsable(db, datos.responsableId);

  return db.accionCorrectora.create({
    data: {
      organisationId,
      riesgoId: riesgo?.id ?? null,
      incidenciaId: incidencia?.id ?? null,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      prioridad: datos.prioridad,
      responsableId: datos.responsableId ?? null,
      fechaLimite: datos.fechaLimite ? aDate(datos.fechaLimite) : null,
      createdById: datos.creadoPorId,
    },
    select: { id: true, titulo: true },
  });
}

export interface ActualizarAccionDatos {
  accionId: string;
  estado: EstadoAccionCorrectora;
  progreso: number;
  motivoBloqueo?: string | undefined;
  eficacia?: string | undefined;
  actorId: string;
}

export async function actualizarAccionCorrectora(
  db: TenantTransactionClient,
  datos: ActualizarAccionDatos,
): Promise<{ id: string; titulo: string; estado: EstadoAccionCorrectora }> {
  const accion = await db.accionCorrectora.findFirst({
    where: { id: datos.accionId, deletedAt: null },
    select: { id: true, titulo: true, estado: true },
  });
  if (!accion) throw new ErrorDeCampo('accionId', 'Esa acción ya no existe.');

  const errores = erroresCambioAccion({
    actual: accion.estado,
    siguiente: datos.estado,
    progreso: datos.progreso,
    motivoBloqueo: datos.motivoBloqueo,
    eficacia: datos.eficacia,
  });
  if (errores[0]) throw new ErrorDeCampo('estado', errores[0]);

  const terminada = datos.estado === 'COMPLETADA' || datos.estado === 'VERIFICADA';
  const verificada = datos.estado === 'VERIFICADA';
  const actualizada = await db.accionCorrectora.update({
    where: { id: accion.id },
    data: {
      estado: datos.estado,
      progreso: datos.progreso,
      motivoBloqueo: datos.estado === 'BLOQUEADA' ? datos.motivoBloqueo : null,
      fechaCierre: terminada ? hoyDate() : null,
      verificadaPorId: verificada ? datos.actorId : null,
      verificadaEn: verificada ? new Date() : null,
      eficacia: verificada ? datos.eficacia : null,
    },
    select: { id: true, titulo: true, estado: true },
  });
  return actualizada;
}

export interface ActualizarIncidenciaDatos {
  incidenciaId: string;
  estado: 'ABIERTA' | 'EN_INVESTIGACION' | 'CERRADA' | 'REABIERTA';
  causaRaiz?: string | undefined;
  leccionesAprendidas?: string | undefined;
  comunicadaAlOrgano: boolean;
  notificadaAAutoridad: boolean;
  referenciaAutoridad?: string | undefined;
}

export async function actualizarIncidencia(
  db: TenantTransactionClient,
  datos: ActualizarIncidenciaDatos,
): Promise<{ referencia: string; estado: string }> {
  const incidencia = await db.incidencia.findFirst({
    where: { id: datos.incidenciaId, deletedAt: null },
    select: {
      id: true,
      referencia: true,
      estado: true,
      gravedad: true,
      esNotificableAAutoridad: true,
      comunicadaAlOrgano: true,
      notificadaAAutoridad: true,
    },
  });
  if (!incidencia) throw new ErrorDeCampo('incidenciaId', 'Esa incidencia ya no existe.');
  if (!puedeCambiarIncidencia(incidencia.estado, datos.estado)) {
    throw new ErrorDeCampo(
      'estado',
      `No se puede pasar de ${incidencia.estado} a ${datos.estado}.`,
    );
  }
  if (datos.estado === 'CERRADA') {
    const errores = erroresCierreIncidencia(
      incidencia.gravedad,
      datos.causaRaiz,
      datos.leccionesAprendidas,
    );
    if (errores[0]) throw new ErrorDeCampo('causaRaiz', errores[0]);
  }
  if (datos.notificadaAAutoridad && !incidencia.esNotificableAAutoridad) {
    throw new ErrorDeCampo(
      'notificadaAAutoridad',
      'Esta incidencia no está marcada como notificable.',
    );
  }
  if (datos.notificadaAAutoridad && (datos.referenciaAutoridad?.trim().length ?? 0) < 3) {
    throw new ErrorDeCampo('referenciaAutoridad', 'Guarda la referencia de la notificación.');
  }

  return db.incidencia.update({
    where: { id: incidencia.id },
    data: {
      estado: datos.estado,
      causaRaiz: datos.causaRaiz ?? null,
      leccionesAprendidas: datos.leccionesAprendidas ?? null,
      fechaCierre: datos.estado === 'CERRADA' ? hoyDate() : null,
      comunicadaAlOrgano: datos.comunicadaAlOrgano,
      fechaComunicacionOrgano:
        datos.comunicadaAlOrgano && !incidencia.comunicadaAlOrgano ? new Date() : undefined,
      notificadaAAutoridad: datos.notificadaAAutoridad,
      fechaNotificacionAutoridad:
        datos.notificadaAAutoridad && !incidencia.notificadaAAutoridad ? new Date() : undefined,
      referenciaAutoridad: datos.notificadaAAutoridad ? datos.referenciaAutoridad : null,
    },
    select: { referencia: true, estado: true },
  });
}
