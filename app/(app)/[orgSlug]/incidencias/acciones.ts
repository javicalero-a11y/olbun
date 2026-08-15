'use server';

import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { assertCan } from '@/lib/auth/can';
import type { SessionContext } from '@/lib/auth/session';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import {
  actualizarAccionCorrectora,
  actualizarIncidencia,
  crearAccionCorrectora,
} from '@/lib/services/ciclo-riesgos';
import { crearIncidencia } from '@/lib/services/riesgos';
import { guardarPersonasImplicadas } from '@/lib/services/personal/incidencias-sensibles';
import {
  accionCorrectoraSchema,
  actualizarAccionCorrectoraSchema,
  actualizarIncidenciaSchema,
  incidenciaSchema,
  personasImplicadasSchema,
} from '@/lib/validation/riesgos';

export interface EstadoIncidencias {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

async function incidenciaAutorizada(
  db: TenantTransactionClient,
  sesion: SessionContext,
  incidenciaId: string,
) {
  const incidencia = await db.incidencia.findFirst({
    where: { id: incidenciaId, deletedAt: null },
    select: { id: true, referencia: true, contratoId: true },
  });
  if (!incidencia) throw new ErrorDeCampo('incidenciaId', 'Esa incidencia ya no existe.');
  assertCan(sesion.actor, 'incidencia:update', {
    organisationId: sesion.organisation.id,
    id: incidencia.id,
    contratoId: incidencia.contratoId,
  });
  return incidencia;
}

const accionCrear = crearAccion({
  nombre: 'incidencia.crear',
  permiso: 'incidencia:create',
  esquema: incidenciaSchema,
  revalidar: ['/:orgSlug/incidencias', '/:orgSlug'],
  async ejecutar(datos, { db, sesion, auditar }) {
    assertCan(sesion.actor, 'incidencia:create', {
      organisationId: sesion.organisation.id,
      contratoId: datos.contratoId ?? null,
    });
    const incidencia = await crearIncidencia(db, sesion.organisation.id, {
      ...datos,
      fechaHecho: new Date(`${datos.fechaHecho}T00:00:00.000Z`),
      creadoPorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'incidencia.crear',
      entidad: 'Incidencia',
      entidadId: incidencia.id,
      descripcion: `${incidencia.referencia} — ${datos.tipo}`,
      despues: {
        referencia: incidencia.referencia,
        tipo: datos.tipo,
        gravedad: datos.gravedad,
        fechaHecho: datos.fechaHecho,
        notificableAAutoridad: datos.esNotificableAAutoridad,
      },
    });
    return incidencia;
  },
});

const accionActualizar = crearAccion({
  nombre: 'incidencia.actualizar',
  permiso: 'incidencia:update',
  esquema: actualizarIncidenciaSchema,
  revalidar: ['/:orgSlug/incidencias', '/:orgSlug'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const existente = await incidenciaAutorizada(db, sesion, datos.incidenciaId);
    const incidencia = await actualizarIncidencia(db, datos);
    auditar({
      tipo: 'MODIFICACION',
      accion: 'incidencia.actualizar',
      entidad: 'Incidencia',
      entidadId: existente.id,
      descripcion: existente.referencia,
      despues: {
        estado: datos.estado,
        comunicadaAlOrgano: datos.comunicadaAlOrgano,
        notificadaAAutoridad: datos.notificadaAAutoridad,
        referenciaAutoridad: datos.referenciaAutoridad,
      },
    });
    return incidencia;
  },
});

const accionPersonasImplicadas = crearAccion({
  nombre: 'incidencia.personas_implicadas.guardar',
  permiso: 'incidencia:view_sensitive',
  esquema: personasImplicadasSchema,
  revalidar: ['/:orgSlug/incidencias'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const existente = await incidenciaAutorizada(db, sesion, datos.incidenciaId);
    assertCan(sesion.actor, 'incidencia:view_sensitive', {
      organisationId: sesion.organisation.id,
      id: existente.id,
      contratoId: existente.contratoId,
    });
    const incidencia = await guardarPersonasImplicadas(
      db,
      datos.incidenciaId,
      datos.personasImplicadas,
    );
    auditar({
      tipo: 'MODIFICACION',
      accion: 'incidencia.personas_implicadas.guardar',
      entidad: 'Incidencia',
      entidadId: incidencia.id,
      descripcion: `${incidencia.referencia} — datos protegidos actualizados`,
      despues: { personasImplicadas: '[CIFRADO]' },
    });
    return incidencia;
  },
});

const accionCrearCorrectora = crearAccion({
  nombre: 'incidencia.accion.crear',
  permiso: 'incidencia:update',
  esquema: accionCorrectoraSchema,
  revalidar: ['/:orgSlug/incidencias'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const incidenciaId = datos.incidenciaId;
    if (!incidenciaId) {
      throw new ErrorDeCampo('incidenciaId', 'Falta la incidencia de la acción.');
    }
    const incidencia = await incidenciaAutorizada(db, sesion, incidenciaId);
    const accion = await crearAccionCorrectora(db, sesion.organisation.id, {
      ...datos,
      creadoPorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'incidencia.accion.crear',
      entidad: 'AccionCorrectora',
      entidadId: accion.id,
      descripcion: `${incidencia.referencia} — ${accion.titulo}`,
      despues: {
        incidenciaId: incidencia.id,
        prioridad: datos.prioridad,
        fechaLimite: datos.fechaLimite,
      },
    });
    return accion;
  },
});

const accionActualizarCorrectora = crearAccion({
  nombre: 'incidencia.accion.actualizar',
  permiso: 'incidencia:update',
  esquema: actualizarAccionCorrectoraSchema,
  revalidar: ['/:orgSlug/incidencias'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const existente = await db.accionCorrectora.findFirst({
      where: { id: datos.accionId, incidenciaId: { not: null }, deletedAt: null },
      select: { id: true, estado: true, incidenciaId: true },
    });
    if (!existente?.incidenciaId) {
      throw new ErrorDeCampo('accionId', 'Esa acción ya no existe.');
    }
    await incidenciaAutorizada(db, sesion, existente.incidenciaId);
    const accion = await actualizarAccionCorrectora(db, { ...datos, actorId: sesion.user.id });
    auditar({
      tipo: 'MODIFICACION',
      accion: 'incidencia.accion.actualizar',
      entidad: 'AccionCorrectora',
      entidadId: accion.id,
      descripcion: accion.titulo,
      antes: { estado: existente.estado },
      despues: { estado: accion.estado, progreso: datos.progreso },
    });
    return accion;
  },
});

export async function crear(orgSlug: string, _previo: EstadoIncidencias, formData: FormData) {
  const resultado = await accionCrear(orgSlug, {
    tipo: texto(formData, 'tipo'),
    gravedad: texto(formData, 'gravedad'),
    fechaHecho: texto(formData, 'fechaHecho'),
    descripcion: texto(formData, 'descripcion'),
    contratoId: texto(formData, 'contratoId'),
    lugar: texto(formData, 'lugar'),
    medidasInmediatas: texto(formData, 'medidasInmediatas'),
    esNotificableAAutoridad: casilla(formData, 'esNotificableAAutoridad') ? 'on' : '',
  });
  return resultado.ok
    ? { exito: `Incidencia ${resultado.datos.referencia} registrada.` }
    : aEstado(resultado);
}

export async function actualizar(
  orgSlug: string,
  _previo: EstadoIncidencias,
  formData: FormData,
) {
  const resultado = await accionActualizar(orgSlug, {
    incidenciaId: texto(formData, 'incidenciaId'),
    estado: texto(formData, 'estado'),
    causaRaiz: texto(formData, 'causaRaiz'),
    leccionesAprendidas: texto(formData, 'leccionesAprendidas'),
    comunicadaAlOrgano: casilla(formData, 'comunicadaAlOrgano') ? 'on' : '',
    notificadaAAutoridad: casilla(formData, 'notificadaAAutoridad') ? 'on' : '',
    referenciaAutoridad: texto(formData, 'referenciaAutoridad'),
  });
  return resultado.ok
    ? { exito: `${resultado.datos.referencia} actualizada a ${resultado.datos.estado}.` }
    : aEstado(resultado);
}

export async function guardarPersonas(
  orgSlug: string,
  _previo: EstadoIncidencias,
  formData: FormData,
) {
  const resultado = await accionPersonasImplicadas(orgSlug, {
    incidenciaId: texto(formData, 'incidenciaId'),
    personasImplicadas: texto(formData, 'personasImplicadas'),
  });
  return resultado.ok
    ? { exito: 'Datos protegidos guardados y cifrados.' }
    : aEstado(resultado);
}

export async function crearCorrectora(
  orgSlug: string,
  _previo: EstadoIncidencias,
  formData: FormData,
) {
  const resultado = await accionCrearCorrectora(orgSlug, {
    riesgoId: undefined,
    incidenciaId: texto(formData, 'incidenciaId'),
    titulo: texto(formData, 'titulo'),
    descripcion: texto(formData, 'descripcion'),
    prioridad: texto(formData, 'prioridad') ?? 'MEDIA',
    responsableId: texto(formData, 'responsableId'),
    fechaLimite: texto(formData, 'fechaLimite'),
  });
  return resultado.ok
    ? { exito: `Acción «${resultado.datos.titulo}» creada.` }
    : aEstado(resultado);
}

export async function actualizarCorrectora(
  orgSlug: string,
  _previo: EstadoIncidencias,
  formData: FormData,
) {
  const resultado = await accionActualizarCorrectora(orgSlug, {
    accionId: texto(formData, 'accionId'),
    estado: texto(formData, 'estado'),
    progreso: texto(formData, 'progreso'),
    motivoBloqueo: texto(formData, 'motivoBloqueo'),
    eficacia: texto(formData, 'eficacia'),
  });
  return resultado.ok
    ? { exito: `Acción «${resultado.datos.titulo}» actualizada.` }
    : aEstado(resultado);
}
