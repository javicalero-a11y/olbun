'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { COOKIE_TEMA, esTema, MAX_AGE_TEMA, TEMA_POR_DEFECTO, type Tema } from '@/lib/tema';

/**
 * Stores the theme choice.
 *
 * Not `httpOnly`: this is a display preference, not a credential, and leaving
 * it readable means a future client-side control can see the current value
 * without another round trip. `sameSite: lax` all the same, so it is not sent
 * on cross-site requests that have no business knowing it.
 */
export async function cambiarTema(valor: string): Promise<void> {
  const tema: Tema = esTema(valor) ? valor : TEMA_POR_DEFECTO;

  (await cookies()).set(COOKIE_TEMA, tema, {
    maxAge: MAX_AGE_TEMA,
    path: '/',
    sameSite: 'lax',
  });

  // Every page renders inside the themed <html>, so they all have to re-render.
  revalidatePath('/', 'layout');
}
