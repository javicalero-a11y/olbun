'use server';

import { assertCan } from '@/lib/auth/can';
import type { SessionContext } from '@/lib/auth/session';
import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import {
  actualizarAccionCorrectora,
  crearAccionCorrectora,
  crearControlRiesgo,
  revisarRiesgo,
} from '@/lib/services/ciclo-riesgos';
import { crearRiesgo } from '@/lib/services/riesgos';
import {
  accionCorrectoraSchema,
  actualizarAccionCorrectoraSchema,
  controlRiesgoSchema,
  revisionRiesgoSchema,
  riesgoSchema,
} from '@/lib/validation/riesgos';

export interface EstadoRiesgos {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionCrear = crearAccion({
  nombre: 'riesgo.crear',
  permiso: 'riesgo:manage',
  esquema: riesgoSchema,
  revalidar: ['/:orgSlug/riesgos', '/:orgSlug'],
  async ejecutar(datos, { db, sesion, auditar }) {
    assertCan(sesion.actor, 'riesgo:manage', {
      organisationId: sesion.organisation.id,
      contratoId: datos.contratoId ?? null,
    });
    const riesgo = await crearRiesgo(db, sesion.organisation.id, {
      ...datos,
      creadoPorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: 'riesgo.crear',
      entidad: 'Riesgo',
      entidadId: riesgo.id,
      descripcion: `${riesgo.referencia} — ${datos.evento}`,
      despues: {
        referencia: riesgo.referencia,
        categoriaId: datos.categoriaId,
        probabilidad: datos.probabilidadInherente,
        impacto: datos.impactoInherente,
        nivel: riesgo.nivelInherente,
        frecuenciaRevisionDias: datos.frecuenciaRevisionDias,
      },
    });
    return riesgo;
  },
});

async function riesgoAutorizado(
  db: TenantTransactionClient,
  sesion: SessionContext,
  riesgoId: string,
) {
  const riesgo = await db.riesgo.findFirst({
    where: { id: riesgoId, deletedAt: null },
    select: { id: true, referencia: true, contratoId: true },
  });
  if (!riesgo) throw new ErrorDeCampo('riesgoId', 'Ese riesgo ya no existe.');
  assertCan(sesion.actor, 'riesgo:manage', {
    organisationId: sesion.organisation.id,
    id: riesgo.id,
    contratoId: riesgo.contratoId,
  });
  return riesgo;
}

const accionRevisar = crearAccion({
  nombre: 'riesgo.revisar',
  permiso: 'riesgo:manage',
  esquema: revisionRiesgoSchema,
  revalidar: ['/:orgSlug/riesgos', '/:orgSlug'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const riesgo = await riesgoAutorizado(db, sesion, datos.riesgoId);
    const resultado = await revisarRiesgo(db, sesion.organisation.id, {
      ...datos,
      revisadaPorId: sesion.user.id,
    });
    auditar({
      tipo: 'MODIFICACION',
      accion: 'riesgo.revisar',
      entidad: 'Riesgo',
      entidadId: riesgo.id,
      descripcion: `${riesgo.referencia} — revisión ${datos.resultado}`,
      despues: {
        resultado: datos.resultado,
        probabilidadResidual: datos.probabilidadResidual,
        impactoResidual: datos.impactoResidual,
        proximaRevision: datos.proximaRevision,
      },
    });
    return resultado;
  },
});

const accionCrearControl = crearAccion({
  nombre: 'riesgo.control.crear',
  permiso: 'riesgo:manage',
  esquema: controlRiesgoSchema,
  revalidar: ['/:orgSlug/riesgos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const riesgo = await riesgoAutorizado(db, sesion, datos.riesgoId);
    const control = await crearControlRiesgo(db, sesion.organisation.id, {
      ...datos,
      creadoPorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'riesgo.control.crear',
      entidad: 'ControlRiesgo',
      entidadId: control.id,
      descripcion: `${riesgo.referencia} — ${control.titulo}`,
      despues: { riesgoId: riesgo.id, tipo: datos.tipo, eficacia: datos.eficacia },
    });
    return control;
  },
});

const accionCrearCorrectora = crearAccion({
  nombre: 'riesgo.accion.crear',
  permiso: 'riesgo:manage',
  esquema: accionCorrectoraSchema,
  revalidar: ['/:orgSlug/riesgos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const riesgoId = datos.riesgoId;
    if (!riesgoId) throw new ErrorDeCampo('riesgoId', 'Falta el riesgo de la acción.');
    const riesgo = await riesgoAutorizado(db, sesion, riesgoId);
    const accion = await crearAccionCorrectora(db, sesion.organisation.id, {
      ...datos,
      creadoPorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'riesgo.accion.crear',
      entidad: 'AccionCorrectora',
      entidadId: accion.id,
      descripcion: `${riesgo.referencia} — ${accion.titulo}`,
      despues: {
        riesgoId: riesgo.id,
        prioridad: datos.prioridad,
        fechaLimite: datos.fechaLimite,
      },
    });
    return accion;
  },
});

const accionActualizarCorrectora = crearAccion({
  nombre: 'riesgo.accion.actualizar',
  permiso: 'riesgo:manage',
  esquema: actualizarAccionCorrectoraSchema,
  revalidar: ['/:orgSlug/riesgos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const existente = await db.accionCorrectora.findFirst({
      where: { id: datos.accionId, riesgoId: { not: null }, deletedAt: null },
      select: { id: true, estado: true, riesgoId: true },
    });
    if (!existente?.riesgoId) throw new ErrorDeCampo('accionId', 'Esa acción ya no existe.');
    await riesgoAutorizado(db, sesion, existente.riesgoId);
    const accion = await actualizarAccionCorrectora(db, { ...datos, actorId: sesion.user.id });
    auditar({
      tipo: 'MODIFICACION',
      accion: 'riesgo.accion.actualizar',
      entidad: 'AccionCorrectora',
      entidadId: accion.id,
      descripcion: accion.titulo,
      antes: { estado: existente.estado },
      despues: { estado: accion.estado, progreso: datos.progreso },
    });
    return accion;
  },
});

export async function crear(orgSlug: string, _previo: EstadoRiesgos, formData: FormData) {
  const resultado = await accionCrear(orgSlug, {
    categoriaId: texto(formData, 'categoriaId'),
    causa: texto(formData, 'causa'),
    evento: texto(formData, 'evento'),
    consecuencia: texto(formData, 'consecuencia'),
    probabilidadInherente: texto(formData, 'probabilidadInherente'),
    impactoInherente: texto(formData, 'impactoInherente'),
    respuesta: texto(formData, 'respuesta') ?? 'MITIGAR',
    contratoId: texto(formData, 'contratoId'),
    responsableId: texto(formData, 'responsableId'),
    frecuenciaRevisionDias: texto(formData, 'frecuenciaRevisionDias') ?? '90',
  });
  return resultado.ok
    ? { exito: `Riesgo ${resultado.datos.referencia} añadido al registro.` }
    : aEstado(resultado);
}

export async function revisar(orgSlug: string, _previo: EstadoRiesgos, formData: FormData) {
  const resultado = await accionRevisar(orgSlug, {
    riesgoId: texto(formData, 'riesgoId'),
    resultado: texto(formData, 'resultado'),
    comentarios: texto(formData, 'comentarios'),
    probabilidadResidual: texto(formData, 'probabilidadResidual'),
    impactoResidual: texto(formData, 'impactoResidual'),
    proximaRevision: texto(formData, 'proximaRevision'),
  });
  return resultado.ok
    ? { exito: `Revisión de ${resultado.datos.referencia} guardada sin alterar el histórico.` }
    : aEstado(resultado);
}

export async function crearControl(
  orgSlug: string,
  _previo: EstadoRiesgos,
  formData: FormData,
) {
  const resultado = await accionCrearControl(orgSlug, {
    riesgoId: texto(formData, 'riesgoId'),
    titulo: texto(formData, 'titulo'),
    descripcion: texto(formData, 'descripcion'),
    tipo: texto(formData, 'tipo'),
    eficacia: texto(formData, 'eficacia') ?? 'NO_EVALUADO',
    esExistente: casilla(formData, 'esExistente') ? 'on' : '',
    responsableId: texto(formData, 'responsableId'),
    ultimaPrueba: texto(formData, 'ultimaPrueba'),
    proximaPrueba: texto(formData, 'proximaPrueba'),
  });
  return resultado.ok
    ? { exito: `Control «${resultado.datos.titulo}» registrado.` }
    : aEstado(resultado);
}

export async function crearCorrectora(
  orgSlug: string,
  _previo: EstadoRiesgos,
  formData: FormData,
) {
  const resultado = await accionCrearCorrectora(orgSlug, {
    riesgoId: texto(formData, 'riesgoId'),
    incidenciaId: undefined,
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
  _previo: EstadoRiesgos,
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
