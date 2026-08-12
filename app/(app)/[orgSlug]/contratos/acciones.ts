'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { contratoSchema, poderAdjudicadorSchema } from '@/lib/validation/contratos';

export interface EstadoContratos {
  error?: string;
  errores?: Record<string, string[]>;
}

function texto(formData: FormData, campo: string): string | undefined {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor : undefined;
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

export async function crearContrato(
  orgSlug: string,
  _previo: EstadoContratos,
  formData: FormData,
): Promise<EstadoContratos> {
  const contexto = await requirePermission(orgSlug, 'contrato:create');

  const parsed = contratoSchema.safeParse({
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
    haySubrogacionPersonal: formData.get('haySubrogacionPersonal') === 'on',
    hayRevisionPrecios: formData.get('hayRevisionPrecios') === 'on',
  });

  if (!parsed.success) return { errores: parsed.error.flatten().fieldErrors };

  const db = tenantClient(contexto.organisation.id);

  // The authority is looked up through the scoped client, so a contract cannot
  // be attached to another tenant's authority by id-guessing.
  const poder = await db.poderAdjudicador.findFirst({
    where: { id: parsed.data.poderAdjudicadorId, deletedAt: null },
    select: { id: true },
  });

  if (!poder) return { errores: { poderAdjudicadorId: ['Ese órgano no existe'] } };

  const yaExiste = await db.contrato.findFirst({
    where: { numeroExpediente: parsed.data.numeroExpediente, deletedAt: null },
    select: { id: true },
  });

  if (yaExiste) {
    return {
      errores: { numeroExpediente: ['Ya tienes un contrato con ese número de expediente'] },
    };
  }

  const fecha = (valor?: string) => (valor ? new Date(`${valor}T00:00:00.000Z`) : null);

  await db.contrato.create({
    data: {
      // See the note above: the scoped client overwrites this field.
      organisationId: contexto.organisation.id,
      numeroExpediente: parsed.data.numeroExpediente,
      objeto: parsed.data.objeto,
      descripcion: parsed.data.descripcion || null,
      poderAdjudicadorId: poder.id,
      tipo: parsed.data.tipo,
      procedimiento: parsed.data.procedimiento,
      estado: parsed.data.estado,
      lote: parsed.data.lote || null,
      fechaFormalizacion: fecha(parsed.data.fechaFormalizacion),
      fechaInicio: fecha(parsed.data.fechaInicio),
      duracionInicialMeses: parsed.data.duracionInicialMeses ?? null,
      fechaFinPrevista: fecha(parsed.data.fechaFinPrevista),
      preavisoProrrogaDias: parsed.data.preavisoProrrogaDias ?? null,
      importeAdjudicacion: parsed.data.importeAdjudicacion ?? null,
      plazoGarantiaMeses: parsed.data.plazoGarantiaMeses ?? null,
      haySubrogacionPersonal: parsed.data.haySubrogacionPersonal ?? false,
      hayRevisionPrecios: parsed.data.hayRevisionPrecios ?? false,
      createdById: contexto.user.id,
    },
  });

  revalidatePath(`/${orgSlug}/contratos`);
  redirect(`/${orgSlug}/contratos`);
}
