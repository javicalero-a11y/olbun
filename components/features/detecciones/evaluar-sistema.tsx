'use client';

import { useActionState } from 'react';

import type { EstadoDetecciones } from '@/app/(app)/[orgSlug]/detecciones/acciones';

const INICIAL: EstadoDetecciones = {};

/**
 * Runs the rules over the tenant's own data.
 *
 * A button rather than a nightly job, for the same reason analysing a message
 * is a button: findings that appear on their own, while nobody is looking, are
 * findings nobody owns.
 */
export function EvaluarSistema({
  evaluar,
}: {
  evaluar: (previo: EstadoDetecciones, datos: FormData) => Promise<EstadoDetecciones>;
}) {
  const [estado, enviar, pendiente] = useActionState(evaluar, INICIAL);

  return (
    <form action={enviar} className="space-y-2">
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
      >
        {pendiente ? 'Revisando…' : 'Revisar el estado del sistema'}
      </button>

      {estado.exito ? (
        <p role="status" className="text-sm text-muted-foreground">
          {estado.exito}
        </p>
      ) : null}
      {estado.error ? (
        <p role="alert" className="text-sm text-destructive">
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
