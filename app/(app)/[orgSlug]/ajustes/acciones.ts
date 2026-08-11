'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Role } from '@prisma/client';

import { requirePermission } from '@/lib/auth/guardias';
import { generarAltaMfa, generarCodigosRecuperacion, verificarCodigoMfa } from '@/lib/auth/mfa';
import { identityClientBecause, tenantClient } from '@/lib/db/tenant';
import { crearInvitacion } from '@/lib/services/invitaciones';
import { emailSchema } from '@/lib/validation/auth';

export interface EstadoAjustes {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

const ROLES = [
  'ORG_ADMIN',
  'GESTOR_CONTRATO',
  'JURIDICO',
  'LETRADO_EXTERNO',
  'CALIDAD',
  'RRHH',
  'ADMIN_CONTABLE',
  'CONTRIBUTOR',
  'VIEWER',
] as const satisfies readonly Role[];

const invitarSchema = z.object({
  email: emailSchema,
  // OWNER is deliberately absent: ownership transfers deliberately, not by
  // invitation.
  role: z.enum(ROLES),
});

export async function invitar(
  orgSlug: string,
  _previo: EstadoAjustes,
  formData: FormData,
): Promise<EstadoAjustes> {
  const contexto = await requirePermission(orgSlug, 'user:invite');

  const parsed = invitarSchema.safeParse({
    email: formData.get('email'),
    role: formData.get('role'),
  });

  if (!parsed.success) {
    return { errores: parsed.error.flatten().fieldErrors };
  }

  const resultado = await crearInvitacion({
    organisationId: contexto.organisation.id,
    organisationName: contexto.organisation.name,
    email: parsed.data.email,
    role: parsed.data.role,
    invitadoPorId: contexto.user.id,
    invitadoPorNombre: contexto.user.name,
  });

  if (!resultado.ok) {
    return {
      error:
        resultado.error === 'YA_ES_MIEMBRO'
          ? 'Esa persona ya forma parte de la organización.'
          : 'Esa persona ya tiene una invitación pendiente.',
    };
  }

  revalidatePath(`/${orgSlug}/ajustes/usuarios`);

  if (!resultado.correoEnviado) {
    return {
      exito: `Invitación creada para ${parsed.data.email}, pero no se ha podido enviar el correo. Pásale este enlace: ${resultado.url}`,
    };
  }

  return { exito: `Invitación enviada a ${parsed.data.email}.` };
}

export async function cambiarRol(
  orgSlug: string,
  membershipId: string,
  role: Role,
): Promise<EstadoAjustes> {
  const contexto = await requirePermission(orgSlug, 'user:update_role');
  const db = tenantClient(contexto.organisation.id);

  const objetivo = await db.membership.findFirst({
    where: { id: membershipId },
    select: { id: true, role: true, userId: true },
  });

  if (!objetivo) return { error: 'No se ha encontrado esa persona.' };

  // The last owner must not be able to demote themselves and lock everyone out
  // of billing and organisation deletion.
  if (objetivo.role === 'OWNER' && role !== 'OWNER') {
    const propietarios = await db.membership.count({
      where: { role: 'OWNER', status: 'ACTIVE', deletedAt: null },
    });

    if (propietarios <= 1) {
      return { error: 'La organización debe conservar al menos un propietario.' };
    }
  }

  await db.membership.update({ where: { id: membershipId }, data: { role } });

  revalidatePath(`/${orgSlug}/ajustes/usuarios`);
  return { exito: 'Rol actualizado.' };
}

export async function cambiarEstado(
  orgSlug: string,
  membershipId: string,
  suspender: boolean,
): Promise<EstadoAjustes> {
  const contexto = await requirePermission(orgSlug, 'user:suspend');
  const db = tenantClient(contexto.organisation.id);

  const objetivo = await db.membership.findFirst({
    where: { id: membershipId },
    select: { id: true, userId: true, role: true },
  });

  if (!objetivo) return { error: 'No se ha encontrado esa persona.' };

  if (objetivo.userId === contexto.user.id) {
    return { error: 'No puedes suspender tu propia cuenta.' };
  }

  if (suspender && objetivo.role === 'OWNER') {
    const propietarios = await db.membership.count({
      where: { role: 'OWNER', status: 'ACTIVE', deletedAt: null },
    });

    if (propietarios <= 1) {
      return { error: 'La organización debe conservar al menos un propietario activo.' };
    }
  }

  await db.membership.update({
    where: { id: membershipId },
    data: { status: suspender ? 'SUSPENDED' : 'ACTIVE' },
  });

  revalidatePath(`/${orgSlug}/ajustes/usuarios`);
  return { exito: suspender ? 'Acceso suspendido.' : 'Acceso restablecido.' };
}

// --- Two-factor authentication -------------------------------------------

export interface EstadoMfa extends EstadoAjustes {
  /** Present while enrolment is in progress. */
  alta?: {
    secretoCifrado: string;
    secretoLegible: string;
    urlOtpauth: string;
  };
  /** Shown exactly once, after enrolment succeeds. */
  codigosRecuperacion?: string[];
}

export async function iniciarAltaMfa(orgSlug: string): Promise<EstadoMfa> {
  const contexto = await requirePermission(orgSlug, 'organisation:view');

  // The secret travels in the form rather than being written to the database
  // before it is proven: an abandoned enrolment must not leave a half-armed
  // second factor on the account.
  return { alta: generarAltaMfa(contexto.user.email) };
}

const confirmarSchema = z.object({
  secretoCifrado: z.string().min(1),
  codigo: z.string().trim().min(1, 'Introduce el código de tu aplicación'),
});

export async function confirmarAltaMfa(
  orgSlug: string,
  _previo: EstadoMfa,
  formData: FormData,
): Promise<EstadoMfa> {
  const contexto = await requirePermission(orgSlug, 'organisation:view');

  const parsed = confirmarSchema.safeParse({
    secretoCifrado: formData.get('secretoCifrado'),
    codigo: formData.get('codigo'),
  });

  if (!parsed.success) {
    return { errores: parsed.error.flatten().fieldErrors };
  }

  if (!verificarCodigoMfa(parsed.data.secretoCifrado, parsed.data.codigo)) {
    return {
      alta: {
        secretoCifrado: parsed.data.secretoCifrado,
        secretoLegible: '',
        urlOtpauth: '',
      },
      errores: { codigo: ['Ese código no coincide. Comprueba la hora de tu dispositivo.'] },
    };
  }

  const { codigos, hashes } = generarCodigosRecuperacion();

  const db = identityClientBecause(
    'two-factor settings live on the global user, not a membership',
  );

  await db.user.update({
    where: { id: contexto.user.id },
    data: {
      mfaEnabled: true,
      mfaSecret: parsed.data.secretoCifrado,
      mfaEnrolledAt: new Date(),
      mfaRecoveryCodes: hashes,
    },
  });

  revalidatePath(`/${orgSlug}/ajustes/seguridad`);
  return {
    exito: 'Verificación en dos pasos activada.',
    codigosRecuperacion: codigos,
  };
}

export async function desactivarMfa(orgSlug: string): Promise<EstadoMfa> {
  const contexto = await requirePermission(orgSlug, 'organisation:view');

  // SPEC §7.4 makes the second factor mandatory for the roles that can read
  // everything, so it cannot simply be switched off.
  if (contexto.actor.role === 'OWNER' || contexto.actor.role === 'ORG_ADMIN') {
    return {
      error:
        'Tu rol exige verificación en dos pasos. Cambia de rol antes de desactivarla, o pide a otra persona con permisos que lo haga.',
    };
  }

  const db = identityClientBecause(
    'two-factor settings live on the global user, not a membership',
  );

  await db.user.update({
    where: { id: contexto.user.id },
    data: { mfaEnabled: false, mfaSecret: null, mfaEnrolledAt: null, mfaRecoveryCodes: [] },
  });

  revalidatePath(`/${orgSlug}/ajustes/seguridad`);
  return { exito: 'Verificación en dos pasos desactivada.' };
}
