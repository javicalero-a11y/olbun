'use client';

import { useActionState } from 'react';

import {
  entrarConGoogle,
  pedirEnlaceDeAcceso,
  type EstadoFormulario,
} from '@/app/(auth)/acciones';
import { Campo, ErrorGeneral } from './campo';

const INICIAL: EstadoFormulario = {};

/**
 * The sign-in routes that are not the password form.
 *
 * The Google button only renders when the deployment has credentials for it —
 * an unconfigured environment shows no button rather than one that fails when
 * clicked.
 */
export function OtrosAccesos({ google }: { google: boolean }) {
  const [estado, enviar, pendiente] = useActionState(pedirEnlaceDeAcceso, INICIAL);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">o</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      {google ? (
        <form action={entrarConGoogle}>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <GoogleIcono />
            Entrar con Google
          </button>
        </form>
      ) : null}

      <form action={enviar} className="space-y-3" noValidate>
        <ErrorGeneral mensaje={estado.error} />

        {/* The field is not called "email": the password form higher up the
            page already owns that id, and two inputs sharing one id leave
            both labels pointing at whichever came first. */}
        <Campo
          etiqueta="Entrar con un enlace por correo"
          nombre="email-enlace"
          type="email"
          autoComplete="email"
          required
          ayuda="Te mandamos un enlace y entras sin contraseña."
          errores={estado.errores?.['email-enlace']}
        />

        <button
          type="submit"
          disabled={pendiente}
          className="w-full rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-60"
        >
          {pendiente ? 'Enviando…' : 'Enviarme un enlace'}
        </button>
      </form>
    </div>
  );
}

function GoogleIcono() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
