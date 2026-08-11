'use server';

import { signOut } from '@/auth';

export async function cerrarSesion(): Promise<void> {
  await signOut({ redirectTo: '/acceso' });
}
