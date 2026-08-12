'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { abrirExpediente } from '@/lib/services/expedientes';
import { expedienteSchema } from '@/lib/validation/expedientes';

export interface EstadoExpedientes {
  error?: string;
  errores?: Record<string, string[]>;
}

function texto(formData: FormData, campo: string): string | undefined {
  const valor = formData.get(campo);
  return typeof valor === 'string' ? valor : undefined;
}

export async function crearExpediente(
  orgSlug: string,
  _previo: EstadoExpedientes,
  formData: FormData,
): Promise<EstadoExpedientes> {
  const contexto = await requirePermission(orgSlug, 'expediente:create');

  const parsed = expedienteSchema.safeParse({
    titulo: texto(formData, 'titulo'),
    tipo: texto(formData, 'tipo'),
    jurisdiccion: texto(formData, 'jurisdiccion'),
    fechaApertura: texto(formData, 'fechaApertura'),
    plantillaId: texto(formData, 'plantillaId'),
    contratoId: texto(formData, 'contratoId'),
    organoCompetente: texto(formData, 'organoCompetente'),
    parteContraria: texto(formData, 'parteContraria'),
    resumen: texto(formData, 'resumen'),
    cuantia: texto(formData, 'cuantia'),
  });

  if (!parsed.success) return { errores: parsed.error.flatten().fieldErrors };

  const db = tenantClient(contexto.organisation.id);

  const resultado = await abrirExpediente(db, contexto.organisation.id, {
    titulo: parsed.data.titulo,
    tipo: parsed.data.tipo,
    jurisdiccion: parsed.data.jurisdiccion,
    fechaApertura: parsed.data.fechaApertura,
    plantillaId: parsed.data.plantillaId,
    contratoId: parsed.data.contratoId,
    organoCompetente: parsed.data.organoCompetente,
    parteContraria: parsed.data.parteContraria,
    resumen: parsed.data.resumen,
    cuantia: parsed.data.cuantia,
    creadoPorId: contexto.user.id,
  });

  revalidatePath(`/${orgSlug}/expedientes`);
  revalidatePath(`/${orgSlug}/plazos`);

  // redirect() throws, so it must be the last thing that happens.
  redirect(`/${orgSlug}/expedientes/${resultado.expedienteId}`);
}
