'use server';

import type { EstadoPersonal } from '../acciones';
import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { crearAccion } from '@/lib/actions/crear-accion';
import { crearAdscripcion, crearPlantillaExigida } from '@/lib/services/personal/adscripciones';
import { adscripcionSchema, plantillaExigidaSchema } from '@/lib/validation/personal';

const resultadoEstado = <T>(
  resultado:
    { ok: true; datos: T } | { ok: false; error: string; errores?: Record<string, string[]> },
  mensaje: (datos: T) => string,
): EstadoPersonal => (resultado.ok ? { exito: mensaje(resultado.datos) } : aEstado(resultado));

const accionAdscripcion = crearAccion({
  nombre: 'empleado.adscribir',
  permiso: 'empleado:manage',
  esquema: adscripcionSchema,
  revalidar: ['/:orgSlug/personal', '/:orgSlug/personal/plantilla'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const adscripcion = await crearAdscripcion(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'empleado.adscribir',
      entidad: 'AdscripcionContrato',
      entidadId: adscripcion.id,
      descripcion: `Adscripción al ${String(datos.porcentajeDedicacion)}%`,
      despues: {
        empleadoId: datos.empleadoId,
        contratoId: datos.contratoId,
        categoriaId: datos.categoriaId,
        porcentajeDedicacion: datos.porcentajeDedicacion,
        cargaTotal: adscripcion.cargaTotal,
      },
    });
    return adscripcion;
  },
});

const accionPlantilla = crearAccion({
  nombre: 'plantilla.exigida.crear',
  permiso: 'empleado:manage',
  esquema: plantillaExigidaSchema,
  revalidar: ['/:orgSlug/personal/plantilla'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const plantilla = await crearPlantillaExigida(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'plantilla.exigida.crear',
      entidad: 'PlantillaExigida',
      entidadId: plantilla.id,
      descripcion: `${datos.centroTrabajo} — ${String(datos.horasSemanales)} h`,
      despues: {
        contratoId: datos.contratoId,
        categoriaId: datos.categoriaId,
        fuente: datos.fuente,
        horasSemanales: datos.horasSemanales,
      },
    });
    return plantilla;
  },
});

export async function crearAdscripcionAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  const resultado = await accionAdscripcion(orgSlug, {
    empleadoId: texto(formData, 'empleadoId'),
    contratoId: texto(formData, 'contratoId'),
    categoriaId: texto(formData, 'categoriaId'),
    centroTrabajo: texto(formData, 'centroTrabajo'),
    horasSemanales: texto(formData, 'horasSemanales'),
    porcentajeDedicacion: texto(formData, 'porcentajeDedicacion'),
    fechaAlta: texto(formData, 'fechaAlta'),
    fechaBaja: texto(formData, 'fechaBaja') ?? '',
    esPersonalClave: casilla(formData, 'esPersonalClave'),
    turno: texto(formData, 'turno'),
  });
  return resultadoEstado(resultado, (datos) => datos.advertencia ?? 'Adscripción creada.');
}

export async function crearPlantillaAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  return resultadoEstado(
    await accionPlantilla(orgSlug, {
      contratoId: texto(formData, 'contratoId'),
      categoriaId: texto(formData, 'categoriaId'),
      centroTrabajo: texto(formData, 'centroTrabajo'),
      numeroPersonas: texto(formData, 'numeroPersonas'),
      horasSemanales: texto(formData, 'horasSemanales'),
      fuente: texto(formData, 'fuente'),
      clausula: texto(formData, 'clausula'),
      esVinculante: casilla(formData, 'esVinculante'),
      penalidadDescripcion: texto(formData, 'penalidadDescripcion') ?? '',
    }),
    () => 'Exigencia de plantilla registrada.',
  );
}
