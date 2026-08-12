'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { crearAccion, ErrorDeCampo } from '@/lib/actions/crear-accion';
import { aEstado, casilla, texto } from '@/lib/actions/formulario';
import { contratoSchema, poderAdjudicadorSchema } from '@/lib/validation/contratos';

export interface EstadoContratos {
  error?: string;
  errores?: Record<string, string[]>;
}

export async function crearPoderAdjudicador(
  orgSlug: string,
  _previo: EstadoContratos,
  formData: FormData,
): Promise<EstadoContratos> {
  const contexto = await requirePermission(orgSlug, 'poder_adjudicador:manage');

  const parsed = poderAdjudicadorSchema.safeParse({
    nombre: texto(formData, 'nombre'),
    tipo: texto(formData, 'tipo'),
    nif: texto(formData, 'nif'),
    codigoDir3: texto(formData, 'codigoDir3'),
    comunidadAutonoma: texto(formData, 'comunidadAutonoma'),
    provincia: texto(formData, 'provincia'),
    municipioNombre: texto(formData, 'municipioNombre'),
    municipioIne: texto(formData, 'municipioIne'),
    sedeElectronicaUrl: texto(formData, 'sedeElectronicaUrl'),
    perfilContratanteUrl: texto(formData, 'perfilContratanteUrl'),
  });

  if (!parsed.success) return { errores: parsed.error.flatten().fieldErrors };

  const db = tenantClient(contexto.organisation.id);

  await db.poderAdjudicador.create({
    data: {
      // Prisma's generated types require organisationId even though the scoped
      // client stamps it. Passing it is harmless: the extension *overwrites*
      // whatever arrives with the organisation the client is bound to, so a
      // wrong value here cannot write into another tenant.
      organisationId: contexto.organisation.id,
      nombre: parsed.data.nombre,
      tipo: parsed.data.tipo,
      nif: parsed.data.nif || null,
      codigoDir3: parsed.data.codigoDir3 || null,
      comunidadAutonoma: parsed.data.comunidadAutonoma || null,
      provincia: parsed.data.provincia || null,
      municipioNombre: parsed.data.municipioNombre || null,
      municipioIne: parsed.data.municipioIne || null,
      sedeElectronicaUrl: parsed.data.sedeElectronicaUrl || null,
      perfilContratanteUrl: parsed.data.perfilContratanteUrl || null,
      createdById: contexto.user.id,
    },
  });

  revalidatePath(`/${orgSlug}/contratos`);
  return {};
}

/**
 * Creating a contract, through the standard action pipeline: the permission
 * check, the transaction and the audit event are the wrapper's job, not this
 * function's. What is left here is the part that is actually about contracts.
 */
const accionCrearContrato = crearAccion({
  nombre: 'contrato.crear',
  permiso: 'contrato:create',
  esquema: contratoSchema,
  revalidar: ['/:orgSlug/contratos'],
  async ejecutar(datos, { db, sesion, auditar }) {
    // Looked up through the scoped client, so a contract cannot be attached to
    // another tenant's authority by guessing an id.
    const poder = await db.poderAdjudicador.findFirst({
      where: { id: datos.poderAdjudicadorId, deletedAt: null },
      select: { id: true },
    });

    if (!poder) throw new ErrorDeCampo('poderAdjudicadorId', 'Ese órgano no existe');

    const yaExiste = await db.contrato.findFirst({
      where: { numeroExpediente: datos.numeroExpediente, deletedAt: null },
      select: { id: true },
    });

    if (yaExiste) {
      throw new ErrorDeCampo(
        'numeroExpediente',
        'Ya tienes un contrato con ese número de expediente',
      );
    }

    const fecha = (valor?: string) => (valor ? new Date(`${valor}T00:00:00.000Z`) : null);

    const contrato = await db.contrato.create({
      data: {
        organisationId: sesion.organisation.id,
        numeroExpediente: datos.numeroExpediente,
        objeto: datos.objeto,
        descripcion: datos.descripcion || null,
        poderAdjudicadorId: poder.id,
        tipo: datos.tipo,
        procedimiento: datos.procedimiento,
        estado: datos.estado,
        lote: datos.lote || null,
        fechaFormalizacion: fecha(datos.fechaFormalizacion),
        fechaInicio: fecha(datos.fechaInicio),
        duracionInicialMeses: datos.duracionInicialMeses ?? null,
        fechaFinPrevista: fecha(datos.fechaFinPrevista),
        preavisoProrrogaDias: datos.preavisoProrrogaDias ?? null,
        importeAdjudicacion: datos.importeAdjudicacion ?? null,
        plazoGarantiaMeses: datos.plazoGarantiaMeses ?? null,
        haySubrogacionPersonal: datos.haySubrogacionPersonal ?? false,
        hayRevisionPrecios: datos.hayRevisionPrecios ?? false,
        createdById: sesion.user.id,
      },
      select: { id: true, numeroExpediente: true, objeto: true },
    });

    auditar({
      tipo: 'CREACION',
      accion: 'contrato.crear',
      entidad: 'Contrato',
      entidadId: contrato.id,
      descripcion: `${contrato.numeroExpediente} — ${contrato.objeto}`,
      despues: { numeroExpediente: contrato.numeroExpediente, objeto: contrato.objeto },
    });

    return contrato;
  },
});

export async function crearContrato(
  orgSlug: string,
  _previo: EstadoContratos,
  formData: FormData,
): Promise<EstadoContratos> {
  const resultado = await accionCrearContrato(orgSlug, {
    numeroExpediente: texto(formData, 'numeroExpediente'),
    objeto: texto(formData, 'objeto'),
    descripcion: texto(formData, 'descripcion'),
    poderAdjudicadorId: texto(formData, 'poderAdjudicadorId'),
    tipo: texto(formData, 'tipo'),
    procedimiento: texto(formData, 'procedimiento'),
    estado: texto(formData, 'estado'),
    lote: texto(formData, 'lote'),
    fechaFormalizacion: texto(formData, 'fechaFormalizacion'),
    fechaInicio: texto(formData, 'fechaInicio'),
    duracionInicialMeses: texto(formData, 'duracionInicialMeses'),
    fechaFinPrevista: texto(formData, 'fechaFinPrevista'),
    preavisoProrrogaDias: texto(formData, 'preavisoProrrogaDias'),
    importeAdjudicacion: texto(formData, 'importeAdjudicacion'),
    plazoGarantiaMeses: texto(formData, 'plazoGarantiaMeses'),
    haySubrogacionPersonal: casilla(formData, 'haySubrogacionPersonal'),
    hayRevisionPrecios: casilla(formData, 'hayRevisionPrecios'),
  });

  if (!resultado.ok) return aEstado(resultado);

  redirect(`/${orgSlug}/contratos`);
}
