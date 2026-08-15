import 'server-only';

import type { ResultadoAccion } from './crear-accion';

/**
 * Bridges a `crearAccion` action to the `useActionState` shape the forms use.
 *
 * The forms want `(previo, formData) => EstadoFormulario`; actions want typed
 * input and give a typed result. Keeping the adapter here means the audit and
 * transaction guarantees are not something each form has to remember, and the
 * components never had to change.
 */

export interface EstadoFormularioAccion {
  error?: string;
  errores?: Record<string, string[]>;
}

/** Reads a form field as a string, treating blanks as absent. */
export function texto(formData: FormData, campo: string): string | undefined {
  const valor = formData.get(campo);
  if (typeof valor !== 'string') return undefined;
  const limpio = valor.trim();
  return limpio.length > 0 ? limpio : undefined;
}

export function casilla(formData: FormData, campo: string): boolean {
  return formData.get(campo) === 'on';
}

export function aEstado<T>(resultado: ResultadoAccion<T>): EstadoFormularioAccion {
  if (resultado.ok) return {};

  // Con errores de campo se devuelve además un mensaje general. Un campo puede
  // no tener dónde enseñar el suyo —una casilla, o uno dentro de una sección
  // plegada— y entonces el formulario se limitaba a no hacer nada: ni guardaba
  // ni decía por qué. Un fallo invisible es peor que uno feo.
  if (resultado.errores) {
    return {
      error: 'Revisa los campos marcados: hay datos que no se han podido guardar.',
      errores: resultado.errores,
    };
  }

  return { error: resultado.error };
}
