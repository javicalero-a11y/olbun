'use client';

import { useActionState } from 'react';

import { acceder, type EstadoFormulario } from '@/app/(auth)/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from './campo';

const INICIAL: EstadoFormulario = {};

export function FormularioAcceso() {
  const [estado, accion, pendiente] = useActionState(acceder, INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      <ErrorGeneral mensaje={estado.error} />

      <Campo
        etiqueta="Correo electrónico"
        nombre="email"
        type="email"
        autoComplete="email"
        required
        errores={estado.errores?.['email']}
      />

      <Campo
        etiqueta="Contraseña"
        nombre="password"
        type="password"
        autoComplete="current-password"
        required
        errores={estado.errores?.['password']}
      />

      {estado.requiereMfa ? (
        <Campo
          etiqueta="Código de verificación"
          nombre="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          ayuda="Los seis dígitos de tu aplicación de autenticación, o un código de recuperación."
          errores={estado.errores?.['codigo']}
        />
      ) : null}

      <BotonEnviar pendiente={pendiente}>
        {estado.requiereMfa ? 'Verificar' : 'Entrar'}
      </BotonEnviar>
    </form>
  );
}
