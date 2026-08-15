import 'server-only';

import { precioHoraOrdinaria } from '@/lib/domain/personal/salarios';
import type { TenantTransactionClient } from '@/lib/db/tenant';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';
import type { ConvenioInput } from '@/lib/validation/personal';

const aDate = (fecha: string): Date => new Date(`${fecha}T00:00:00.000Z`);

export async function crearConvenio(
  db: TenantTransactionClient,
  organisationId: string,
  datos: ConvenioInput & { actorId: string },
) {
  const repetido = await db.convenioColectivo.findFirst({
    where: { nombre: datos.nombre, vigenciaDesde: aDate(datos.vigenciaDesde), deletedAt: null },
    select: { id: true },
  });
  if (repetido) throw new ErrorDeCampo('nombre', 'Ese convenio y vigencia ya existen.');

  return db.convenioColectivo.create({
    data: {
      organisationId,
      nombre: datos.nombre,
      ambito: datos.ambito,
      sector: datos.sector,
      provincia: datos.provincia ?? null,
      codigoBoletin: datos.codigoBoletin ?? null,
      fechaPublicacion: datos.fechaPublicacion ? aDate(datos.fechaPublicacion) : null,
      vigenciaDesde: aDate(datos.vigenciaDesde),
      vigenciaHasta: datos.vigenciaHasta ? aDate(datos.vigenciaHasta) : null,
      enUltraactividad: datos.enUltraactividad,
      urlBoletin: datos.urlBoletin ?? null,
      createdById: datos.actorId,
    },
    select: { id: true, nombre: true },
  });
}

export async function crearCategoriaProfesional(
  db: TenantTransactionClient,
  organisationId: string,
  datos: {
    convenioId: string;
    grupo: string;
    nivel?: string | undefined;
    denominacion: string;
    grupoCotizacionSS: number;
    actorId: string;
  },
) {
  const convenio = await db.convenioColectivo.findFirst({
    where: { id: datos.convenioId, deletedAt: null },
    select: { id: true },
  });
  if (!convenio) throw new ErrorDeCampo('convenioId', 'Ese convenio ya no existe.');
  const repetida = await db.categoriaProfesional.findFirst({
    where: {
      convenioId: datos.convenioId,
      grupo: datos.grupo,
      nivel: datos.nivel ?? null,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (repetida) throw new ErrorDeCampo('grupo', 'Ese grupo y nivel ya existen en el convenio.');

  return db.categoriaProfesional.create({
    data: {
      organisationId,
      convenioId: datos.convenioId,
      grupo: datos.grupo,
      nivel: datos.nivel ?? null,
      denominacion: datos.denominacion,
      grupoCotizacionSS: datos.grupoCotizacionSS,
      createdById: datos.actorId,
    },
    select: { id: true, denominacion: true },
  });
}

export async function crearTablaSalarial(
  db: TenantTransactionClient,
  organisationId: string,
  datos: {
    convenioId: string;
    categoriaId: string;
    ano: number;
    salarioBaseMensual: number;
    numeroPagas: number;
    jornadaAnualHoras: number;
    precioHoraExtra?: number | undefined;
    vigenciaDesde: string;
    actorId: string;
  },
) {
  const categoria = await db.categoriaProfesional.findFirst({
    where: { id: datos.categoriaId, deletedAt: null },
    select: { id: true, convenioId: true },
  });
  if (!categoria || categoria.convenioId !== datos.convenioId) {
    throw new ErrorDeCampo('categoriaId', 'La categoría no pertenece a ese convenio.');
  }
  const precio = precioHoraOrdinaria(datos);
  return db.tablaSalarial.create({
    data: {
      organisationId,
      convenioId: datos.convenioId,
      categoriaId: datos.categoriaId,
      ano: datos.ano,
      salarioBaseMensual: datos.salarioBaseMensual,
      numeroPagas: datos.numeroPagas,
      jornadaAnualHoras: datos.jornadaAnualHoras,
      precioHoraOrdinaria: precio,
      precioHoraExtra: datos.precioHoraExtra ?? null,
      vigenciaDesde: aDate(datos.vigenciaDesde),
      createdById: datos.actorId,
    },
    select: { id: true, ano: true, precioHoraOrdinaria: true },
  });
}

export async function vincularConvenioAContrato(
  db: TenantTransactionClient,
  organisationId: string,
  datos: { contratoId: string; convenioId: string; esPrincipal: boolean; actorId: string },
) {
  const [contrato, convenio] = await Promise.all([
    db.contrato.findFirst({
      where: { id: datos.contratoId, deletedAt: null },
      select: { id: true },
    }),
    db.convenioColectivo.findFirst({
      where: { id: datos.convenioId, deletedAt: null },
      select: { id: true },
    }),
  ]);
  if (!contrato) throw new ErrorDeCampo('contratoId', 'Ese contrato ya no existe.');
  if (!convenio) throw new ErrorDeCampo('convenioId', 'Ese convenio ya no existe.');
  if (datos.esPrincipal) {
    await db.contratoConvenio.updateMany({
      where: { contratoId: datos.contratoId, deletedAt: null },
      data: { esPrincipal: false },
    });
  }
  const existente = await db.contratoConvenio.findFirst({
    where: { contratoId: datos.contratoId, convenioId: datos.convenioId, deletedAt: null },
    select: { id: true },
  });
  if (existente) {
    return db.contratoConvenio.update({
      where: { id: existente.id },
      data: { esPrincipal: datos.esPrincipal },
      select: { id: true },
    });
  }
  return db.contratoConvenio.create({
    data: {
      organisationId,
      contratoId: datos.contratoId,
      convenioId: datos.convenioId,
      esPrincipal: datos.esPrincipal,
      createdById: datos.actorId,
    },
    select: { id: true },
  });
}
