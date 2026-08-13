import type { Metadata } from 'next';
import Link from 'next/link';

import { PanelAuth } from '@/components/features/auth/panel';

export const metadata: Metadata = { title: 'Revisa tu correo' };

/**
 * Shown after asking for a magic link.
 *
 * Says the same thing whether or not the address has an account, so the form
 * cannot be used to find out who is registered.
 */
export default function RevisaTuCorreoPage() {
  return (
    <PanelAuth>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Revisa tu correo</h1>
          <p className="text-sm text-muted-foreground">
            Si esa dirección tiene cuenta en Olbun, te hemos enviado un enlace para entrar.
          </p>
        </div>

        <div className="rounded-md border border-border px-3 py-3">
          <p className="text-xs text-muted-foreground">
            El enlace caduca en 15 minutos y sólo sirve una vez. Si no llega, mira en la carpeta
            de correo no deseado antes de pedir otro.
          </p>
        </div>

        <p className="text-sm text-muted-foreground">
          <Link
            href="/acceso"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Volver a entrar
          </Link>
        </p>
      </div>
    </PanelAuth>
  );
}
