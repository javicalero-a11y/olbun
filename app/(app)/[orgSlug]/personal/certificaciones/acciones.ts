'use server';

import type { EstadoPersonal } from '../acciones';
import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { crearAccion } from '@/lib/actions/crear-accion';
import {
  crearCertificacionEmpleado,
  crearTipoCertificacion,
} from '@/lib/services/personal/certificaciones';
import {
  certificacionEmpleadoSchema,
  tipoCertificacionSchema,
} from '@/lib/validation/personal';

const resultadoEstado = <T>(
  resultado:
    { ok: true; datos: T } | { ok: false; error: string; errores?: Record<string, string[]> },
  mensaje: (datos: T) => string,
): EstadoPersonal => (resultado.ok ? { exito: mensaje(resultado.datos) } : aEstado(resultado));

const accionTipoCertificacion = crearAccion({
  nombre: 'certificacion.tipo.crear',
  permiso: 'empleado:manage',
  esquema: tipoCertificacionSchema,
  revalidar: ['/:orgSlug/personal/certificaciones'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const tipo = await crearTipoCertificacion(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'certificacion.tipo.crear',
      entidad: 'TipoCertificacion',
      entidadId: tipo.id,
      descripcion: tipo.nombre,
      despues: {
        codigo: datos.codigo,
        diasAviso: datos.diasAviso,
        esObligatoria: datos.esObligatoria,
      },
    });
    return tipo;
  },
});

const accionCertificacion = crearAccion({
  nombre: 'certificacion.empleado.crear',
  permiso: 'empleado:manage',
  esquema: certificacionEmpleadoSchema,
  revalidar: ['/:orgSlug/personal', '/:orgSlug/personal/certificaciones'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const certificacion = await crearCertificacionEmpleado(
      db,
      sesion.organisation.id,
      sesion.organisation.timezone,
      { ...datos, actorId: sesion.user.id },
    );
    auditar({
      tipo: 'CREACION',
      accion: 'certificacion.empleado.crear',
      entidad: 'CertificacionEmpleado',
      entidadId: certificacion.id,
      descripcion: `Certificación — ${certificacion.estado}`,
      despues: {
        empleadoId: datos.empleadoId,
        tipoId: datos.tipoId,
        fechaCaducidad: datos.fechaCaducidad,
        estado: certificacion.estado,
      },
    });
    return certificacion;
  },
});

export async function crearTipoCertificacionAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  const resultado = await accionTipoCertificacion(orgSlug, {
    codigo: texto(formData, 'codigo'),
    nombre: texto(formData, 'nombre'),
    periodoRenovacionMeses: texto(formData, 'periodoRenovacionMeses') || undefined,
    diasAviso: texto(formData, 'diasAviso'),
    esObligatoria: casilla(formData, 'esObligatoria'),
  });
  return resultadoEstado(resultado, (datos) => `Tipo ${datos.nombre} creado.`);
}

export async function crearCertificacionAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  const resultado = await accionCertificacion(orgSlug, {
    empleadoId: texto(formData, 'empleadoId'),
    tipoId: texto(formData, 'tipoId'),
    referencia: texto(formData, 'referencia') ?? '',
    emitidaPor: texto(formData, 'emitidaPor') ?? '',
    fechaEmision: texto(formData, 'fechaEmision') ?? '',
    fechaCaducidad: texto(formData, 'fechaCaducidad') ?? '',
    documentoId: texto(formData, 'documentoId') ?? '',
  });
  return resultadoEstado(
    resultado,
    (datos) => `Certificación registrada como ${datos.estado}.`,
  );
}
