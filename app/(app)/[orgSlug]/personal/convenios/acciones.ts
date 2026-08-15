'use server';

import { z } from 'zod';

import type { EstadoPersonal } from '../acciones';
import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { crearAccion } from '@/lib/actions/crear-accion';
import {
  crearCategoriaProfesional,
  crearConvenio,
  crearTablaSalarial,
  vincularConvenioAContrato,
} from '@/lib/services/personal/convenios';
import {
  categoriaProfesionalSchema,
  convenioSchema,
  tablaSalarialSchema,
} from '@/lib/validation/personal';

const resultadoEstado = <T>(
  resultado:
    { ok: true; datos: T } | { ok: false; error: string; errores?: Record<string, string[]> },
  mensaje: (datos: T) => string,
): EstadoPersonal => (resultado.ok ? { exito: mensaje(resultado.datos) } : aEstado(resultado));

const accionConvenio = crearAccion({
  nombre: 'convenio.crear',
  permiso: 'convenio:manage',
  esquema: convenioSchema,
  revalidar: ['/:orgSlug/personal/convenios'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const convenio = await crearConvenio(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'convenio.crear',
      entidad: 'ConvenioColectivo',
      entidadId: convenio.id,
      descripcion: convenio.nombre,
      despues: {
        ambito: datos.ambito,
        sector: datos.sector,
        vigenciaDesde: datos.vigenciaDesde,
      },
    });
    return convenio;
  },
});

const accionCategoria = crearAccion({
  nombre: 'convenio.categoria.crear',
  permiso: 'convenio:manage',
  esquema: categoriaProfesionalSchema,
  revalidar: ['/:orgSlug/personal/convenios'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const categoria = await crearCategoriaProfesional(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'convenio.categoria.crear',
      entidad: 'CategoriaProfesional',
      entidadId: categoria.id,
      descripcion: categoria.denominacion,
      despues: { convenioId: datos.convenioId, grupo: datos.grupo, nivel: datos.nivel },
    });
    return categoria;
  },
});

const accionTabla = crearAccion({
  nombre: 'convenio.tabla.crear',
  permiso: 'convenio:manage',
  esquema: tablaSalarialSchema,
  revalidar: ['/:orgSlug/personal/convenios'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const tabla = await crearTablaSalarial(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'convenio.tabla.crear',
      entidad: 'TablaSalarial',
      entidadId: tabla.id,
      descripcion: `Tabla ${String(tabla.ano)}`,
      despues: {
        convenioId: datos.convenioId,
        categoriaId: datos.categoriaId,
        ano: datos.ano,
        salarioBaseMensual: datos.salarioBaseMensual,
        precioHoraOrdinaria: tabla.precioHoraOrdinaria.toString(),
      },
    });
    return {
      id: tabla.id,
      ano: tabla.ano,
      precioHoraOrdinaria: tabla.precioHoraOrdinaria.toString(),
    };
  },
});

const vinculoSchema = z.object({
  contratoId: z.string().min(1),
  convenioId: z.string().min(1),
  esPrincipal: z.boolean(),
});

const accionVinculo = crearAccion({
  nombre: 'convenio.contrato.vincular',
  permiso: 'convenio:manage',
  esquema: vinculoSchema,
  revalidar: ['/:orgSlug/personal/convenios'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const vinculo = await vincularConvenioAContrato(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'convenio.contrato.vincular',
      entidad: 'ContratoConvenio',
      entidadId: vinculo.id,
      descripcion: 'Convenio aplicable vinculado',
      despues: datos,
    });
    return vinculo;
  },
});

export async function crearConvenioAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  const resultado = await accionConvenio(orgSlug, {
    nombre: texto(formData, 'nombre'),
    ambito: texto(formData, 'ambito'),
    sector: texto(formData, 'sector'),
    provincia: texto(formData, 'provincia') ?? '',
    codigoBoletin: texto(formData, 'codigoBoletin') ?? '',
    fechaPublicacion: texto(formData, 'fechaPublicacion') ?? '',
    vigenciaDesde: texto(formData, 'vigenciaDesde'),
    vigenciaHasta: texto(formData, 'vigenciaHasta') ?? '',
    enUltraactividad: casilla(formData, 'enUltraactividad'),
    urlBoletin: texto(formData, 'urlBoletin') ?? '',
  });
  return resultadoEstado(resultado, (datos) => `Convenio ${datos.nombre} creado.`);
}

export async function crearCategoriaAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  const resultado = await accionCategoria(orgSlug, {
    convenioId: texto(formData, 'convenioId'),
    grupo: texto(formData, 'grupo'),
    nivel: texto(formData, 'nivel') ?? '',
    denominacion: texto(formData, 'denominacion'),
    grupoCotizacionSS: texto(formData, 'grupoCotizacionSS'),
  });
  return resultadoEstado(resultado, (datos) => `Categoría ${datos.denominacion} creada.`);
}

export async function crearTablaAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  const resultado = await accionTabla(orgSlug, {
    convenioId: texto(formData, 'convenioId'),
    categoriaId: texto(formData, 'categoriaId'),
    ano: texto(formData, 'ano'),
    salarioBaseMensual: texto(formData, 'salarioBaseMensual'),
    numeroPagas: texto(formData, 'numeroPagas'),
    jornadaAnualHoras: texto(formData, 'jornadaAnualHoras'),
    precioHoraExtra: texto(formData, 'precioHoraExtra') ?? '',
    vigenciaDesde: texto(formData, 'vigenciaDesde'),
  });
  return resultadoEstado(
    resultado,
    (datos) => `Tabla ${String(datos.ano)} creada a ${datos.precioHoraOrdinaria} €/h.`,
  );
}

export async function vincularConvenioAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  return resultadoEstado(
    await accionVinculo(orgSlug, {
      contratoId: texto(formData, 'contratoId'),
      convenioId: texto(formData, 'convenioId'),
      esPrincipal: casilla(formData, 'esPrincipal'),
    }),
    () => 'Convenio vinculado al contrato.',
  );
}
