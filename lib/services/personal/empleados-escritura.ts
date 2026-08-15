import 'server-only';

import {
  cifrarObjeto,
  indiceNif,
  indicesNifLegibles,
  type DatosLaboralesProtegidos,
  type IdentificacionProtegida,
} from '@/lib/crypto/datos-personales';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';
import type { EmpleadoInput } from '@/lib/validation/personal';

const aDate = (fecha: string): Date => new Date(`${fecha}T00:00:00.000Z`);

function tieneValores(valor: object): boolean {
  return Object.values(valor).some((item) => item !== undefined);
}

export async function crearEmpleado(
  db: TenantTransactionClient,
  organisationId: string,
  datos: EmpleadoInput & { actorId: string },
): Promise<{ id: string; numeroEmpleado: string; nombreCompleto: string }> {
  const repetido = await db.empleado.findFirst({
    where: { numeroEmpleado: datos.numeroEmpleado, deletedAt: null },
    select: { id: true },
  });
  if (repetido) {
    throw new ErrorDeCampo('numeroEmpleado', 'Ese número de empleado ya está en uso.');
  }

  const nifHash = datos.nif ? indiceNif(datos.nif) : null;
  if (
    nifHash &&
    (await db.empleado.findFirst({
      where: { nifHash: { in: indicesNifLegibles(datos.nif ?? '') }, deletedAt: null },
      select: { id: true },
    }))
  ) {
    throw new ErrorDeCampo('nif', 'Ya existe una persona con ese NIF/NIE.');
  }

  if (datos.categoriaId) {
    const categoria = await db.categoriaProfesional.findFirst({
      where: { id: datos.categoriaId, deletedAt: null },
      select: { convenioId: true },
    });
    if (!categoria || categoria.convenioId !== datos.convenioId) {
      throw new ErrorDeCampo('categoriaId', 'La categoría no pertenece al convenio elegido.');
    }
  }
  if (datos.contratoOrigenSubrogacionId) {
    const contrato = await db.contrato.findFirst({
      where: { id: datos.contratoOrigenSubrogacionId, deletedAt: null },
      select: { id: true },
    });
    if (!contrato) {
      throw new ErrorDeCampo('contratoOrigenSubrogacionId', 'Ese contrato ya no existe.');
    }
  }

  const identificacion: IdentificacionProtegida = {
    nif: datos.nif,
    numeroAfiliacionSS: datos.numeroAfiliacionSS,
    codigoCuentaCotizacion: datos.codigoCuentaCotizacion,
  };
  const laborales: DatosLaboralesProtegidos = {
    complementoAdPersonam: datos.complementoAdPersonam,
    motivoReduccion: datos.motivoReduccion,
    tieneDiscapacidadReconocida: datos.tieneDiscapacidadReconocida,
  };

  const empleado = await db.empleado.create({
    data: {
      organisationId,
      numeroEmpleado: datos.numeroEmpleado,
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      email: datos.email ?? null,
      telefono: datos.telefono ?? null,
      puesto: datos.puesto ?? null,
      estado: datos.estado,
      fechaAlta: aDate(datos.fechaAlta),
      fechaBaja: datos.fechaBaja ? aDate(datos.fechaBaja) : null,
      nifHash,
      datosIdentificacionCifrados: tieneValores(identificacion)
        ? cifrarObjeto(identificacion)
        : null,
      datosLaboralesCifrados: tieneValores(laborales) ? cifrarObjeto(laborales) : null,
      categoriaId: datos.categoriaId ?? null,
      convenioId: datos.convenioId ?? null,
      codigoContratoSEPE: datos.codigoContratoSEPE ?? null,
      grupoCotizacion: datos.grupoCotizacion ?? null,
      jornadaPorcentaje: datos.jornadaPorcentaje,
      horasSemanales: datos.horasSemanales,
      antiguedadReconocida: aDate(datos.antiguedadReconocida),
      esSubrogado: datos.esSubrogado,
      contratoOrigenSubrogacionId: datos.contratoOrigenSubrogacionId ?? null,
      tieneReduccionJornada: datos.tieneReduccionJornada,
      esRepresentanteTrabajadores: datos.esRepresentanteTrabajadores,
      createdById: datos.actorId,
    },
    select: { id: true, numeroEmpleado: true, nombre: true, apellidos: true },
  });

  return {
    id: empleado.id,
    numeroEmpleado: empleado.numeroEmpleado,
    nombreCompleto: `${empleado.nombre} ${empleado.apellidos}`,
  };
}
