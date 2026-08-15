'use server';

import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { ausenciaSchema, cierreAusenciaSchema } from '@/lib/validation/ausencias';
import { cerrarAusencia, crearAusencia } from '@/lib/services/personal/ausencias';
import { crearAccion } from '@/lib/actions/crear-accion';
import type { TipoAusencia } from '@prisma/client';

export interface EstadoAusencias {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionCrear = crearAccion({
  nombre: 'ausencia.registrar',
  permiso: 'empleado:manage',
  esquema: ausenciaSchema,
  revalidar: ['/:orgSlug/personal', '/:orgSlug/personal/ausencias'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const ausencia = await crearAusencia(db, sesion.organisation.id, {
      empleadoId: datos.empleadoId,
      tipo: datos.tipo as TipoAusencia,
      subtipo: datos.subtipo,
      fechaInicio: datos.fechaInicio,
      fechaFinPrevista: datos.fechaFinPrevista,
      numeroParteSS: datos.numeroParteSS,
      mutua: datos.mutua,
      esRecaida: datos.esRecaida,
      actorId: sesion.user.id,
    });

    auditar({
      tipo: 'CREACION',
      accion: 'ausencia.registrar',
      entidad: 'Ausencia',
      entidadId: ausencia.id,
      // Ni diagnóstico ni sospecha de él: el tipo y las fechas bastan para
      // saber qué pasó con la cobertura, y son dato laboral, no de salud.
      descripcion: `${String(ausencia.tipo)} — ${String(ausencia.diasLaborables)} días laborables`,
      despues: {
        tipo: ausencia.tipo,
        diasNaturales: ausencia.diasNaturales,
        diasLaborables: ausencia.diasLaborables,
      },
    });

    return ausencia;
  },
});

const accionCerrar = crearAccion({
  nombre: 'ausencia.cerrar',
  permiso: 'empleado:manage',
  esquema: cierreAusenciaSchema,
  revalidar: ['/:orgSlug/personal', '/:orgSlug/personal/ausencias'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const ausencia = await cerrarAusencia(
      db,
      datos.ausenciaId,
      datos.fechaFinReal,
      sesion.user.id,
    );

    auditar({
      tipo: 'MODIFICACION',
      accion: 'ausencia.cerrar',
      entidad: 'Ausencia',
      entidadId: ausencia.id,
      descripcion: `Vuelta el ${datos.fechaFinReal}: ${String(ausencia.diasLaborables)} días laborables`,
      despues: { fechaFinReal: datos.fechaFinReal, diasLaborables: ausencia.diasLaborables },
    });

    return ausencia;
  },
});

export async function registrarAusencia(
  orgSlug: string,
  _previo: EstadoAusencias,
  formData: FormData,
): Promise<EstadoAusencias> {
  const resultado = await accionCrear(orgSlug, {
    empleadoId: texto(formData, 'empleadoId') ?? '',
    tipo: texto(formData, 'tipo') ?? '',
    subtipo: texto(formData, 'subtipo') ?? '',
    fechaInicio: texto(formData, 'fechaInicio') ?? '',
    fechaFinPrevista: texto(formData, 'fechaFinPrevista') ?? '',
    numeroParteSS: texto(formData, 'numeroParteSS') ?? '',
    mutua: texto(formData, 'mutua') ?? '',
    esRecaida: casilla(formData, 'esRecaida'),
  });

  if (!resultado.ok) return aEstado(resultado);

  const { diasLaborables, diasNaturales } = resultado.datos;

  return {
    exito: `Ausencia registrada: ${String(diasNaturales)} días naturales, ${String(diasLaborables)} laborables.`,
  };
}

export async function cerrar(
  orgSlug: string,
  _previo: EstadoAusencias,
  formData: FormData,
): Promise<EstadoAusencias> {
  const resultado = await accionCerrar(orgSlug, {
    ausenciaId: texto(formData, 'ausenciaId') ?? '',
    fechaFinReal: texto(formData, 'fechaFinReal') ?? '',
  });

  if (!resultado.ok) return aEstado(resultado);

  return {
    exito: `Cerrada: ${String(resultado.datos.diasLaborables)} días laborables computados.`,
  };
}
