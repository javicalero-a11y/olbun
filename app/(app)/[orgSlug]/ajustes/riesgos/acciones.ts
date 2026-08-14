'use server';

import { crearAccion } from '@/lib/actions/crear-accion';
import {
  actualizarBandasRiesgo,
  actualizarCategoriaRiesgo,
  crearCategoriaRiesgo,
} from '@/lib/services/configuracion-riesgos';
import {
  bandasRiesgoSchema,
  categoriaRiesgoActualizarSchema,
  categoriaRiesgoCrearSchema,
} from '@/lib/validation/riesgos';

export interface EstadoConfiguracionRiesgos {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionCrearCategoria = crearAccion({
  nombre: 'riesgo.categoria_crear',
  permiso: 'settings:manage',
  esquema: categoriaRiesgoCrearSchema,
  revalidar: ['/:orgSlug/ajustes/riesgos', '/:orgSlug/riesgos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const categoria = await crearCategoriaRiesgo(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: 'riesgo.categoria_crear',
      entidad: 'CategoriaRiesgo',
      entidadId: categoria.id,
      descripcion: `Categoría de riesgo «${categoria.nombre}» creada`,
      despues: datos,
    });

    return categoria;
  },
});

const accionActualizarCategoria = crearAccion({
  nombre: 'riesgo.categoria_actualizar',
  permiso: 'settings:manage',
  esquema: categoriaRiesgoActualizarSchema,
  revalidar: ['/:orgSlug/ajustes/riesgos', '/:orgSlug/riesgos'],
  async ejecutar(datos, { db, auditar }) {
    const antes = await db.categoriaRiesgo.findFirst({
      where: { id: datos.categoriaId, deletedAt: null },
      select: { nombre: true, color: true, isActive: true },
    });
    const categoria = await actualizarCategoriaRiesgo(db, datos);

    auditar({
      tipo: 'MODIFICACION',
      accion: 'riesgo.categoria_actualizar',
      entidad: 'CategoriaRiesgo',
      entidadId: categoria.id,
      descripcion: `Configuración de «${categoria.nombre}» actualizada`,
      antes: antes ?? undefined,
      despues: { nombre: datos.nombre, color: datos.color, isActive: datos.isActive },
    });

    return categoria;
  },
});

const accionActualizarBandas = crearAccion({
  nombre: 'riesgo.matriz_actualizar',
  permiso: 'settings:manage',
  esquema: bandasRiesgoSchema,
  revalidar: ['/:orgSlug/ajustes/riesgos', '/:orgSlug/riesgos'],
  async ejecutar(datos, { db, auditar }) {
    const antes = await db.bandaRiesgo.findMany({
      where: { deletedAt: null },
      select: {
        nivel: true,
        nombre: true,
        puntuacionMinima: true,
        puntuacionMaxima: true,
        color: true,
      },
      orderBy: { orden: 'asc' },
    });

    const bandas = [
      {
        nivel: 'BAJO' as const,
        nombre: datos.bajoNombre,
        desde: 1,
        hasta: datos.bajoHasta,
        color: datos.bajoColor,
      },
      {
        nivel: 'MEDIO' as const,
        nombre: datos.medioNombre,
        desde: datos.bajoHasta + 1,
        hasta: datos.medioHasta,
        color: datos.medioColor,
      },
      {
        nivel: 'ALTO' as const,
        nombre: datos.altoNombre,
        desde: datos.medioHasta + 1,
        hasta: datos.altoHasta,
        color: datos.altoColor,
      },
      {
        nivel: 'MUY_ALTO' as const,
        nombre: datos.muyAltoNombre,
        desde: datos.altoHasta + 1,
        hasta: 25,
        color: datos.muyAltoColor,
      },
    ];

    await actualizarBandasRiesgo(db, bandas);

    auditar({
      tipo: 'MODIFICACION',
      accion: 'riesgo.matriz_actualizar',
      entidad: 'BandaRiesgo',
      descripcion: 'Umbrales de la matriz de riesgo actualizados',
      antes: { bandas: antes },
      despues: { bandas },
    });

    return { bandas: bandas.length };
  },
});

export async function crearCategoria(
  orgSlug: string,
  _previo: EstadoConfiguracionRiesgos,
  formData: FormData,
): Promise<EstadoConfiguracionRiesgos> {
  const resultado = await accionCrearCategoria(orgSlug, {
    clave: formData.get('clave'),
    nombre: formData.get('nombre'),
    color: formData.get('color'),
  });
  if (!resultado.ok) return { error: resultado.error, errores: resultado.errores };
  return { exito: `Categoría «${resultado.datos.nombre}» creada.` };
}

export async function actualizarCategoria(
  orgSlug: string,
  _previo: EstadoConfiguracionRiesgos,
  formData: FormData,
): Promise<EstadoConfiguracionRiesgos> {
  const resultado = await accionActualizarCategoria(orgSlug, {
    categoriaId: formData.get('categoriaId'),
    nombre: formData.get('nombre'),
    color: formData.get('color'),
    isActive: formData.get('isActive') ?? '',
  });
  if (!resultado.ok) return { error: resultado.error, errores: resultado.errores };
  return { exito: `Categoría «${resultado.datos.nombre}» actualizada.` };
}

export async function actualizarBandas(
  orgSlug: string,
  _previo: EstadoConfiguracionRiesgos,
  formData: FormData,
): Promise<EstadoConfiguracionRiesgos> {
  const resultado = await accionActualizarBandas(orgSlug, Object.fromEntries(formData));
  if (!resultado.ok) return { error: resultado.error, errores: resultado.errores };
  return {
    exito: 'Matriz de riesgo actualizada. Las valoraciones históricas no han cambiado.',
  };
}
