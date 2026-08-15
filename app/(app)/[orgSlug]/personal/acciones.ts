'use server';

import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { crearAccion } from '@/lib/actions/crear-accion';
import { crearEmpleado } from '@/lib/services/personal/empleados-escritura';
import { empleadoSchema } from '@/lib/validation/personal';

export interface EstadoPersonal {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const accionEmpleado = crearAccion({
  nombre: 'empleado.crear',
  permiso: 'empleado:manage',
  esquema: empleadoSchema,
  revalidar: ['/:orgSlug/personal'],
  async ejecutar(datos, { db, sesion, auditar }) {
    const empleado = await crearEmpleado(db, sesion.organisation.id, {
      ...datos,
      actorId: sesion.user.id,
    });
    auditar({
      tipo: 'CREACION',
      accion: 'empleado.crear',
      entidad: 'Empleado',
      entidadId: empleado.id,
      descripcion: `${empleado.numeroEmpleado} — ${empleado.nombreCompleto}`,
      despues: {
        numeroEmpleado: empleado.numeroEmpleado,
        estado: datos.estado,
        convenioId: datos.convenioId,
        categoriaId: datos.categoriaId,
      },
    });
    return empleado;
  },
});

export async function crearEmpleadoAction(
  orgSlug: string,
  _previo: EstadoPersonal,
  formData: FormData,
): Promise<EstadoPersonal> {
  const resultado = await accionEmpleado(orgSlug, {
    numeroEmpleado: texto(formData, 'numeroEmpleado'),
    nombre: texto(formData, 'nombre'),
    apellidos: texto(formData, 'apellidos'),
    email: texto(formData, 'email') ?? '',
    telefono: texto(formData, 'telefono') ?? '',
    puesto: texto(formData, 'puesto') ?? '',
    estado: texto(formData, 'estado'),
    fechaAlta: texto(formData, 'fechaAlta'),
    fechaBaja: texto(formData, 'fechaBaja') ?? '',
    nif: texto(formData, 'nif') ?? '',
    numeroAfiliacionSS: texto(formData, 'numeroAfiliacionSS') ?? '',
    codigoCuentaCotizacion: texto(formData, 'codigoCuentaCotizacion') ?? '',
    categoriaId: texto(formData, 'categoriaId') ?? '',
    convenioId: texto(formData, 'convenioId') ?? '',
    codigoContratoSEPE: texto(formData, 'codigoContratoSEPE') ?? '',
    grupoCotizacion: texto(formData, 'grupoCotizacion') || undefined,
    jornadaPorcentaje: texto(formData, 'jornadaPorcentaje'),
    horasSemanales: texto(formData, 'horasSemanales'),
    antiguedadReconocida: texto(formData, 'antiguedadReconocida'),
    complementoAdPersonam: texto(formData, 'complementoAdPersonam') ?? '',
    esSubrogado: casilla(formData, 'esSubrogado'),
    contratoOrigenSubrogacionId: texto(formData, 'contratoOrigenSubrogacionId') ?? '',
    tieneReduccionJornada: casilla(formData, 'tieneReduccionJornada'),
    motivoReduccion: texto(formData, 'motivoReduccion') || undefined,
    tieneDiscapacidadReconocida: casilla(formData, 'tieneDiscapacidadReconocida'),
    esRepresentanteTrabajadores: casilla(formData, 'esRepresentanteTrabajadores'),
  });
  return resultado.ok
    ? { exito: `Empleado ${resultado.datos.numeroEmpleado} creado.` }
    : aEstado(resultado);
}
