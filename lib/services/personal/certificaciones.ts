import 'server-only';

import type { Prisma } from '@prisma/client';

import { cifrar } from '@/lib/crypto/cifrado';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { hoyEn, type FechaCivil } from '@/lib/domain/fecha';
import { estadoDeCertificacion } from '@/lib/domain/personal/caducidades';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';

const aDate = (fecha: string): Date => new Date(`${fecha}T00:00:00.000Z`);

export const TIPOS_CERTIFICACION_POR_DEFECTO = [
  {
    codigo: 'PRL_PUESTO',
    nombre: 'PRL específica del puesto',
    diasAviso: 30,
    esObligatoria: true,
  },
  {
    codigo: 'MANIPULADOR_ALIMENTOS',
    nombre: 'Manipulación de alimentos',
    diasAviso: 60,
    esObligatoria: false,
  },
  {
    codigo: 'PLATAFORMA_ELEVADORA',
    nombre: 'Plataformas elevadoras PEMP',
    diasAviso: 60,
    esObligatoria: false,
  },
  {
    codigo: 'FITOSANITARIOS',
    nombre: 'Aplicador de productos fitosanitarios',
    diasAviso: 90,
    esObligatoria: false,
  },
  {
    codigo: 'DESFIBRILADOR',
    nombre: 'Uso de desfibrilador DEA',
    diasAviso: 60,
    esObligatoria: false,
  },
] as const;

export async function sembrarTiposCertificacion(
  db: Prisma.TransactionClient,
  organisationId: string,
  actorId: string,
): Promise<void> {
  for (const tipo of TIPOS_CERTIFICACION_POR_DEFECTO) {
    // El filtro por organización es obligatorio aquí, y es fácil olvidarlo: el
    // alta corre sobre el cliente elevado, que no está limitado por RLS porque
    // la organización todavía no existe cuando empieza la transacción. Sin él,
    // `findFirst` encontraba el código de OTRA organización y no sembraba
    // nada: sólo la primera empresa registrada tenía tipos y ninguna de las
    // siguientes podía registrar un certificado.
    const existe = await db.tipoCertificacion.findFirst({
      where: { organisationId, codigo: tipo.codigo },
      select: { id: true },
    });
    if (!existe) {
      await db.tipoCertificacion.create({
        data: { organisationId, ...tipo, createdById: actorId },
      });
    }
  }
}

export async function crearTipoCertificacion(
  db: TenantTransactionClient,
  organisationId: string,
  datos: {
    codigo: string;
    nombre: string;
    periodoRenovacionMeses?: number | undefined;
    diasAviso: number;
    esObligatoria: boolean;
    actorId: string;
  },
) {
  const existe = await db.tipoCertificacion.findFirst({
    where: { codigo: datos.codigo, deletedAt: null },
    select: { id: true },
  });
  if (existe) throw new ErrorDeCampo('codigo', 'Ese código de certificación ya existe.');
  return db.tipoCertificacion.create({
    data: {
      organisationId,
      codigo: datos.codigo,
      nombre: datos.nombre,
      periodoRenovacionMeses: datos.periodoRenovacionMeses ?? null,
      diasAviso: datos.diasAviso,
      esObligatoria: datos.esObligatoria,
      createdById: datos.actorId,
    },
    select: { id: true, nombre: true },
  });
}

export async function crearCertificacionEmpleado(
  db: TenantTransactionClient,
  organisationId: string,
  zona: string,
  datos: {
    empleadoId: string;
    tipoId: string;
    referencia?: string | undefined;
    emitidaPor?: string | undefined;
    fechaEmision?: FechaCivil | undefined;
    fechaCaducidad?: FechaCivil | undefined;
    documentoId?: string | undefined;
    actorId: string;
  },
) {
  const [empleado, tipo] = await Promise.all([
    db.empleado.findFirst({
      where: { id: datos.empleadoId, deletedAt: null },
      select: { id: true },
    }),
    db.tipoCertificacion.findFirst({
      where: { id: datos.tipoId, isActive: true, deletedAt: null },
      select: { id: true, diasAviso: true },
    }),
  ]);
  if (!empleado) throw new ErrorDeCampo('empleadoId', 'Esa persona ya no existe.');
  if (!tipo) throw new ErrorDeCampo('tipoId', 'Ese tipo de certificación ya no está activo.');
  if (datos.documentoId) {
    const documento = await db.documento.findFirst({
      where: { id: datos.documentoId, deletedAt: null },
      select: { id: true },
    });
    if (!documento) throw new ErrorDeCampo('documentoId', 'Ese documento ya no existe.');
  }
  const estado = estadoDeCertificacion(datos.fechaCaducidad, hoyEn(zona), tipo.diasAviso);
  return db.certificacionEmpleado.create({
    data: {
      organisationId,
      empleadoId: datos.empleadoId,
      tipoId: datos.tipoId,
      referenciaCifrada: datos.referencia ? cifrar(datos.referencia) : null,
      emitidaPor: datos.emitidaPor ?? null,
      fechaEmision: datos.fechaEmision ? aDate(datos.fechaEmision) : null,
      fechaCaducidad: datos.fechaCaducidad ? aDate(datos.fechaCaducidad) : null,
      estado,
      documentoId: datos.documentoId ?? null,
      verificadaPorId: datos.actorId,
      verificadaEn: new Date(),
      createdById: datos.actorId,
    },
    select: { id: true, estado: true },
  });
}
