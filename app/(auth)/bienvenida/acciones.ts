'use server';

import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import {
  aceptarInvitacionPendiente,
  crearOrganizacionPara,
} from '@/lib/services/incorporacion';

export interface EstadoBienvenida {
  error?: string;
  errores?: Record<string, string[]>;
}

async function usuarioActual(): Promise<string> {
  const session = await auth();
  const userId = session?.user?.id;
  // The route is behind the middleware's session check, so this only fires if
  // the session expired between rendering the page and submitting the form.
  if (!userId) redirect('/acceso');
  return userId;
}

export async function aceptarInvitacion(
  membershipId: string,
  _previo: EstadoBienvenida,
  _formData: FormData,
): Promise<EstadoBienvenida> {
  const userId = await usuarioActual();

  const resultado = await aceptarInvitacionPendiente(userId, membershipId);

  if (!resultado.ok) {
    return { error: 'Esa invitación ya no está disponible. Pide que te la envíen otra vez.' };
  }

  redirect(`/${resultado.organisationSlug}`);
}

export async function crearOrganizacion(
  _previo: EstadoBienvenida,
  formData: FormData,
): Promise<EstadoBienvenida> {
  const userId = await usuarioActual();

  const empresa = formData.get('empresa');
  const nombre = formData.get('nombre');

  if (typeof empresa !== 'string' || empresa.trim().length < 2) {
    return { errores: { empresa: ['Escribe el nombre de tu empresa u organismo.'] } };
  }

  const resultado = await crearOrganizacionPara(userId, {
    empresa,
    nombre: typeof nombre === 'string' ? nombre : undefined,
  });

  if (!resultado.ok) {
    return { errores: { empresa: ['Escribe el nombre de tu empresa u organismo.'] } };
  }

  redirect(`/${resultado.organisationSlug}`);
}
