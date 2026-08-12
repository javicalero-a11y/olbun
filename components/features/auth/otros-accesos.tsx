'use client';

import { useActionState } from 'react';

import {
  entrarConGoogle,
  entrarConMicrosoft,
  pedirEnlaceDeAcceso,
  type EstadoFormulario,
} from '@/app/(auth)/acciones';
import { Campo, ErrorGeneral } from './campo';

const INICIAL: EstadoFormulario = {};

const BOTON_EXTERNO =
  'flex w-full items-center justify-center gap-2.5 rounded-md border border-input px-4 py-2 text-sm font-medium';

/**
 * The sign-in routes that are not the password form.
 *
 * In production the Google button exists only when the deployment has
 * credentials for it: a button that fails when pressed is worse than no
 * button. In development it is shown disabled instead, so this page can be
 * reviewed as it will really look without a Google Cloud project existing.
 */
export type EstadoProveedor = 'activo' | 'sin-configurar' | 'oculto';

/** One button, in whichever of the three states its credentials put it. */
function BotonProveedor({
  estado,
  accion,
  etiqueta,
  icono,
  variables,
}: {
  estado: EstadoProveedor;
  accion: () => Promise<void>;
  etiqueta: string;
  icono: React.ReactNode;
  variables: React.ReactNode;
}) {
  if (estado === 'oculto') return null;

  if (estado === 'activo') {
    return (
      <form action={accion}>
        <button type="submit" className={`${BOTON_EXTERNO} hover:bg-accent`}>
          {icono}
          {etiqueta}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-1.5">
      <button type="button" disabled className={`${BOTON_EXTERNO} opacity-50`}>
        {icono}
        {etiqueta}
      </button>
      <p className="text-xs text-muted-foreground">
        Sólo en desarrollo: define {variables} para activarlo. En producción este botón no
        aparece hasta que estén configurados.
      </p>
    </div>
  );
}

export function OtrosAccesos({
  google,
  microsoft,
}: {
  google: EstadoProveedor;
  microsoft: EstadoProveedor;
}) {
  const [estado, enviar, pendiente] = useActionState(pedirEnlaceDeAcceso, INICIAL);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">o</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <BotonProveedor
        estado={google}
        accion={entrarConGoogle}
        etiqueta="Entrar con Google"
        icono={<GoogleIcono />}
        variables={
          <>
            <code>GOOGLE_CLIENT_ID</code> y <code>GOOGLE_CLIENT_SECRET</code>
          </>
        }
      />

      <BotonProveedor
        estado={microsoft}
        accion={entrarConMicrosoft}
        etiqueta="Entrar con Microsoft"
        icono={<MicrosoftIcono />}
        variables={
          <>
            <code>MICROSOFT_CLIENT_ID</code> y <code>MICROSOFT_CLIENT_SECRET</code>
          </>
        }
      />

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

function MicrosoftIcono() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path fill="#F25022" d="M0 0h7.5v7.5H0z" />
      <path fill="#7FBA00" d="M8.5 0H16v7.5H8.5z" />
      <path fill="#00A4EF" d="M0 8.5h7.5V16H0z" />
      <path fill="#FFB900" d="M8.5 8.5H16V16H8.5z" />
    </svg>
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
