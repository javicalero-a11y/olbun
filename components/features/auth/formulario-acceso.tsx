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

      <BotonEnviar pendiente={pendiente}>Entrar</BotonEnviar>
    </form>
  );
}
