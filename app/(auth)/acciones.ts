'use server';

import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';

import { signIn } from '@/auth';
import { defaultOrganisationSlugForEmail } from '@/lib/auth/session';
import { isPasswordBreached } from '@/lib/auth/password';
import { registrarOrganizacion } from '@/lib/services/registro';
import { signInSchema, signUpSchema } from '@/lib/validation/auth';

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

  try {
    await signIn('credentials', {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // One message for every failure mode — wrong password, unknown address,
      // locked account — so the form cannot be used to enumerate users.
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
