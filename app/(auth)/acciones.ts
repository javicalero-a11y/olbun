'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { defaultOrganisationSlugForEmail } from '@/lib/auth/session';
import { isPasswordBreached } from '@/lib/auth/password';
import { aceptarInvitacion } from '@/lib/services/invitaciones';
import { hashPassword } from '@/lib/auth/password';
import { registrarOrganizacion } from '@/lib/services/registro';
import { verificarCredenciales } from '@/lib/services/acceso';
import { passwordSchema, signInSchema, signUpSchema } from '@/lib/validation/auth';
import { z } from 'zod';

/**
 * Server actions for the authentication pages.
 *
 * Both return a flat error shape for `useActionState` rather than throwing, so
 * the form can re-render with the message in place. Successful paths end in a
 * redirect, which Next signals by throwing — hence the try/finally shape.
 */

export interface EstadoFormulario {
  error?: string;
  errores?: Record<string, string[]>;
  /** Password accepted; the form now asks for the second factor. */
  requiereMfa?: boolean;
}

export async function registrarse(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const parsed = signUpSchema.safeParse({
    nombre: formData.get('nombre'),
    empresa: formData.get('empresa'),
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { errores: parsed.error.flatten().fieldErrors };
  }

  // Advisory only: HIBP being down must not block sign-up (SPEC §7.4).
  if (await isPasswordBreached(parsed.data.password)) {
    return {
      errores: {
        password: [
          'Esa contraseña aparece en filtraciones públicas conocidas. Elige otra distinta.',
        ],
      },
    };
  }

  const resultado = await registrarOrganizacion(parsed.data);

  if (!resultado.ok) {
    // Same wording whatever the cause, so the form cannot be used to find out
    // which addresses are already registered.
    return { error: 'No hemos podido crear la cuenta con esos datos.' };
  }

  await signIn('credentials', {
    email: parsed.data.email,
    password: parsed.data.password,
    redirect: false,
  });

  redirect(`/${resultado.organisationSlug}`);
}

export async function acceder(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { errores: parsed.error.flatten().fieldErrors };
  }

  const codigoBruto = formData.get('codigo');
  const codigo =
    typeof codigoBruto === 'string' && codigoBruto.trim() ? codigoBruto : undefined;

  // Check credentials first so the form knows whether to ask for a second
  // factor. Revealing that MFA is expected is safe: you only reach this branch
  // by already knowing the password.
  const resultado = await verificarCredenciales(
    parsed.data.email,
    parsed.data.password,
    codigo,
  );

  switch (resultado.estado) {
    case 'CREDENCIALES_INVALIDAS':
      // One message for every failure mode so the form cannot enumerate users.
      return { error: 'Correo o contraseña incorrectos.' };

    case 'BLOQUEADA':
      return {
        error:
          'Demasiados intentos fallidos. Tu cuenta queda bloqueada 15 minutos por seguridad.',
      };

    case 'MFA_REQUERIDA':
      return { requiereMfa: true };

    case 'MFA_INVALIDA':
      return {
        requiereMfa: true,
        errores: { codigo: ['Ese código no es válido. Vuelve a intentarlo.'] },
      };

    case 'OK':
      break;
  }

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      codigo: codigo ?? '',
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Correo o contraseña incorrectos.' };
    }
    throw error;
  }

  const slug = await defaultOrganisationSlugForEmail(parsed.data.email);

  if (!slug) {
    return { error: 'Tu cuenta no pertenece a ninguna organización activa.' };
  }

  redirect(`/${slug}`);
}

const aceptarSchema = z.object({
  token: z.string().min(1),
  password: z.string().optional(),
});

/**
 * Accepts an invitation. Someone who already has an account just gains the
 * membership; someone invited before they had one sets their password here, in
 * the same transaction that activates the membership.
 */
export async function aceptar(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const parsed = aceptarSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password') ?? undefined,
  });

  if (!parsed.success) {
    return { error: 'Enlace de invitación no válido.' };
  }

  let passwordHash: string | null = null;

  if (parsed.data.password) {
    const validada = passwordSchema.safeParse(parsed.data.password);

    if (!validada.success) {
      return { errores: { password: validada.error.issues.map((i) => i.message) } };
    }

    if (await isPasswordBreached(validada.data)) {
      return {
        errores: {
          password: ['Esa contraseña aparece en filtraciones públicas conocidas. Elige otra.'],
        },
      };
    }

    passwordHash = await hashPassword(validada.data);
  }

  const resultado = await aceptarInvitacion(parsed.data.token, passwordHash);

  if (!resultado.ok) {
    return { error: 'Este enlace ha caducado o ya se ha utilizado.' };
  }

  redirect(`/acceso?invitacion=aceptada`);
}

/**
 * Starts a sign-in that is not the password form.
 *
 * Both end at `/bienvenida` rather than at an organisation URL, because
 * neither knows which organisation the person belongs to — or whether they
 * belong to one at all. That page decides.
 */
export async function entrarConGoogle(): Promise<void> {
  await signIn('google', { redirectTo: '/bienvenida' });
}

export async function pedirEnlaceDeAcceso(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  // Its own field name, because the password form on the same page already
  // uses `email` and two inputs cannot share an id.
  const email = formData.get('email-enlace');

  const parsed = z.email().safeParse(typeof email === 'string' ? email.trim() : '');
  if (!parsed.success) {
    return { errores: { 'email-enlace': ['Escribe una dirección de correo válida.'] } };
  }

  await signIn('nodemailer', {
    email: parsed.data,
    redirectTo: '/bienvenida',
  });

  return {};
}
