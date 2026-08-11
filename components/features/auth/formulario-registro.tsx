'use client';

import { useActionState } from 'react';

import { registrarse, type EstadoFormulario } from '@/app/(auth)/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from './campo';

const INICIAL: EstadoFormulario = {};

export function FormularioRegistro() {
  const [estado, accion, pendiente] = useActionState(registrarse, INICIAL);

  return (
    <form action={accion} className="space-y-4" noValidate>
      <ErrorGeneral mensaje={estado.error} />

      <Campo
        etiqueta="Tu nombre"
        nombre="nombre"
        autoComplete="name"
        required
        errores={estado.errores?.['nombre']}
      />

      <Campo
        etiqueta="Empresa"
        nombre="empresa"
        autoComplete="organization"
        required
        ayuda="Aparecerá en la dirección de tu espacio de trabajo."
        errores={estado.errores?.['empresa']}
      />

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
        autoComplete="new-password"
        required
        ayuda="Mínimo 12 caracteres."
        errores={estado.errores?.['password']}
      />

      <BotonEnviar pendiente={pendiente}>Crear cuenta</BotonEnviar>
    </form>
  );
}
