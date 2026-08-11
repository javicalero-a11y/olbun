'use client';

import { useActionState } from 'react';

import type { EstadoFormulario } from '@/app/(auth)/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from './campo';

const INICIAL: EstadoFormulario = {};

export function FormularioInvitacion({
  token,
  necesitaContrasena,
  accion,
}: {
  token: string;
  necesitaContrasena: boolean;
  accion: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />

      <ErrorGeneral mensaje={estado.error} />

      {necesitaContrasena ? (
        <Campo
          etiqueta="Elige una contraseña"
          nombre="password"
          type="password"
          autoComplete="new-password"
          required
          ayuda="Mínimo 12 caracteres."
          errores={estado.errores?.['password']}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Ya tienes una cuenta en Olbun, así que sólo tienes que aceptar. Entrarás con tu
          contraseña habitual.
        </p>
      )}

      <BotonEnviar pendiente={pendiente}>Aceptar invitación</BotonEnviar>
    </form>
  );
}
