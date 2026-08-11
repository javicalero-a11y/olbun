'use client';

import { useActionState, useState, useTransition } from 'react';

import type { EstadoMfa } from '@/app/(app)/[orgSlug]/ajustes/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoMfa = {};

interface PanelMfaProps {
  activada: boolean;
  obligatoria: boolean;
  iniciar: () => Promise<EstadoMfa>;
  confirmar: (previo: EstadoMfa, formData: FormData) => Promise<EstadoMfa>;
  desactivar: () => Promise<EstadoMfa>;
  /** Generated server-side so the QR never depends on a client-side library. */
  qrDataUri?: string;
}

export function PanelMfa({
  activada,
  obligatoria,
  iniciar,
  confirmar,
  desactivar,
  qrDataUri,
}: PanelMfaProps) {
  const [alta, setAlta] = useState<EstadoMfa['alta']>();
  const [qr, setQr] = useState<string | undefined>(qrDataUri);
  const [mensaje, setMensaje] = useState<string>();
  const [pendienteInicio, startInicio] = useTransition();
  const [estado, confirmarAccion, pendienteConfirmar] = useActionState(confirmar, INICIAL);

  const codigos = estado.codigosRecuperacion;
  const yaActivada = activada || Boolean(codigos);

  if (codigos) {
    return (
      <div className="space-y-4">
        <p
          role="status"
          className="rounded-md border border-status-green/30 bg-status-green-subtle px-3 py-2 text-sm text-status-green"
        >
          Verificación en dos pasos activada.
        </p>

        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold">Códigos de recuperación</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Guárdalos ahora en un lugar seguro. No volverán a mostrarse, y cada uno sirve una
            sola vez si pierdes el acceso a tu aplicación.
          </p>
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm" data-numeric>
            {codigos.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (yaActivada) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          <span className="font-medium text-status-green">Activada.</span> Se te pedirá un
          código cada vez que entres.
        </p>

        {mensaje ? <ErrorGeneral mensaje={mensaje} /> : null}

        {obligatoria ? (
          <p className="text-xs text-muted-foreground">
            Tu rol accede a toda la información de la organización, así que la verificación en
            dos pasos es obligatoria y no puede desactivarse.
          </p>
        ) : (
          <button
            type="button"
            disabled={pendienteInicio}
            onClick={() => {
              startInicio(async () => {
                const r = await desactivar();
                setMensaje(r.error);
              });
            }}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Desactivar
          </button>
        )}
      </div>
    );
  }

  if (!alta) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Añade un segundo factor con una aplicación de autenticación. Sin él, una contraseña
          robada basta para entrar.
        </p>

        <button
          type="button"
          disabled={pendienteInicio}
          onClick={() => {
            startInicio(async () => {
              const r = await iniciar();
              setAlta(r.alta);
              setQr(r.alta ? await generarQr(r.alta.urlOtpauth) : undefined);
            });
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {pendienteInicio ? 'Un momento…' : 'Activar verificación en dos pasos'}
        </button>
      </div>
    );
  }

  return (
    <form action={confirmarAccion} className="space-y-4" noValidate>
      <input type="hidden" name="secretoCifrado" value={alta.secretoCifrado} />

      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>Escanea este código con tu aplicación de autenticación.</li>
        <li>Introduce los seis dígitos que muestre.</li>
      </ol>

      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI generated server-side; next/image adds nothing here
        <img
          src={qr}
          alt="Código QR para configurar la verificación en dos pasos"
          width={180}
          height={180}
          className="rounded-lg border border-border bg-white p-2"
        />
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-muted-foreground">
          No puedo escanear el código
        </summary>
        <p className="mt-2 text-xs">
          Introduce esta clave manualmente:{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs break-all">
            {alta.secretoLegible}
          </code>
        </p>
      </details>

      <Campo
        etiqueta="Código de la aplicación"
        nombre="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        errores={estado.errores?.['codigo']}
      />

      <div className="max-w-48">
        <BotonEnviar pendiente={pendienteConfirmar}>Confirmar</BotonEnviar>
      </div>
    </form>
  );
}

/** Fetches the QR from the route handler that renders it server-side. */
async function generarQr(urlOtpauth: string): Promise<string | undefined> {
  const respuesta = await fetch(`/api/mfa/qr?dato=${encodeURIComponent(urlOtpauth)}`);
  if (!respuesta.ok) return undefined;
  return respuesta.text();
}
