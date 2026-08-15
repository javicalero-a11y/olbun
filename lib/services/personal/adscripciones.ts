import 'server-only';

import type { FuentePlantillaExigida, Prisma, TurnoTrabajo } from '@prisma/client';

import { cargaConNuevaAdscripcion } from '@/lib/domain/personal/adscripciones';
import type { FechaCivil } from '@/lib/domain/fecha';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';

const aDate = (fecha: string): Date => new Date(`${fecha}T00:00:00.000Z`);
const aFecha = (fecha: Date): FechaCivil => fecha.toISOString().slice(0, 10);

export async function crearAdscripcion(
  db: TenantTransactionClient,
  organisationId: string,
  datos: {
    empleadoId: string;
    contratoId: string;
    categoriaId: string;
    centroTrabajo: string;
    horasSemanales: number;
    porcentajeDedicacion: number;
    fechaAlta: FechaCivil;
    fechaBaja?: FechaCivil | undefined;
    esPersonalClave: boolean;
    turno: TurnoTrabajo;
    actorId: string;
  },
) {
  const [empleado, contrato, categoria] = await Promise.all([
    db.empleado.findFirst({
      where: { id: datos.empleadoId, deletedAt: null },
      select: { id: true },
    }),
    db.contrato.findFirst({
      where: { id: datos.contratoId, deletedAt: null },
      select: { id: true },
    }),
    db.categoriaProfesional.findFirst({
      where: { id: datos.categoriaId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!empleado) throw new ErrorDeCampo('empleadoId', 'Esa persona ya no existe.');
  if (!contrato) throw new ErrorDeCampo('contratoId', 'Ese contrato ya no existe.');
  if (!categoria) throw new ErrorDeCampo('categoriaId', 'Esa categoría ya no existe.');

  const existentes = await db.adscripcionContrato.findMany({
    where: { empleadoId: datos.empleadoId, deletedAt: null },
    select: { porcentajeDedicacion: true, fechaAlta: true, fechaBaja: true },
  });
  const carga = cargaConNuevaAdscripcion(
    existentes.map((item) => ({
      porcentajeDedicacion: Number(item.porcentajeDedicacion),
      fechaAlta: aFecha(item.fechaAlta),
      fechaBaja: item.fechaBaja ? aFecha(item.fechaBaja) : undefined,
    })),
    {
      porcentajeDedicacion: datos.porcentajeDedicacion,
      fechaAlta: datos.fechaAlta,
      fechaBaja: datos.fechaBaja,
    },
  );
  if (carga.bloqueada) {
    throw new ErrorDeCampo(
      'porcentajeDedicacion',
      `La asignación llevaría la carga al ${String(carga.total)}%; el límite de seguridad es 150%.`,
    );
  }

  const adscripcion = await db.adscripcionContrato.create({
    data: {
      organisationId,
      empleadoId: datos.empleadoId,
      contratoId: datos.contratoId,
      categoriaId: datos.categoriaId,
      centroTrabajo: datos.centroTrabajo,
      horasSemanales: datos.horasSemanales,
      porcentajeDedicacion: datos.porcentajeDedicacion,
      fechaAlta: aDate(datos.fechaAlta),
      fechaBaja: datos.fechaBaja ? aDate(datos.fechaBaja) : null,
      esPersonalClave: datos.esPersonalClave,
      turno: datos.turno,
      createdById: datos.actorId,
    },
    select: { id: true },
  });
  return {
    ...adscripcion,
    cargaTotal: carga.total,
    advertencia: carga.superaJornada
      ? `La persona queda asignada al ${String(carga.total)}%.`
      : null,
  };
}

export async function crearPlantillaExigida(
  db: TenantTransactionClient,
  organisationId: string,
  datos: {
    contratoId: string;
    categoriaId: string;
    centroTrabajo: string;
    numeroPersonas: number;
    horasSemanales: number;
    fuente: FuentePlantillaExigida;
    clausula: string;
    esVinculante: boolean;
    penalidadDescripcion?: string | undefined;
    actorId: string;
  },
) {
  const [contrato, categoria] = await Promise.all([
    db.contrato.findFirst({
      where: { id: datos.contratoId, deletedAt: null },
      select: { id: true },
    }),
    db.categoriaProfesional.findFirst({
      where: { id: datos.categoriaId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!contrato) throw new ErrorDeCampo('contratoId', 'Ese contrato ya no existe.');
  if (!categoria) throw new ErrorDeCampo('categoriaId', 'Esa categoría ya no existe.');
  return db.plantillaExigida.create({
    data: {
      organisationId,
      contratoId: datos.contratoId,
      categoriaId: datos.categoriaId,
      centroTrabajo: datos.centroTrabajo,
      numeroPersonas: datos.numeroPersonas,
      horasSemanales: datos.horasSemanales,
      fuente: datos.fuente,
      clausula: datos.clausula,
      esVinculante: datos.esVinculante,
      penalidadAsociada: datos.penalidadDescripcion
        ? ({ descripcion: datos.penalidadDescripcion } satisfies Prisma.InputJsonObject)
        : undefined,
      createdById: datos.actorId,
    },
    select: { id: true },
  });
}
