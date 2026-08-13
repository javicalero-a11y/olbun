'use client';

import { useActionState } from 'react';

import type { EstadoDetecciones } from '@/app/(app)/[orgSlug]/detecciones/acciones';

/**
 * Running the detection engine over one message.
 *
 * Deliberately a button rather than something that happens on upload. Analysis
 * costs money and takes seconds, and an upload that silently spends both is an
 * upload people learn to avoid. It also means a failure — no credentials, the
 * API down — surfaces as "this did not run", next to the thing that did not
 * run, instead of as a half-failed upload.
 */
export function BotonAnalizar({
  comunicacionId,
  accion,
}: {
  comunicacionId: string;
  accion: (previo: EstadoDetecciones, formData: FormData) => Promise<EstadoDetecciones>;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});

  return (
    <form action={enviar} className="inline">
      <input type="hidden" name="comunicacionId" value={comunicacionId} />

      <button
        type="submit"
        disabled={pendiente}
        className="rounded-md border border-input px-2 py-1 text-xs font-medium disabled:opacity-60"
      >
        {pendiente ? 'Analizando…' : 'Analizar'}
      </button>

      {estado.exito ? (
        <span role="status" className="ml-2 text-xs text-status-green">
          {estado.exito}
        </span>
      ) : null}

      {estado.error ? (
        <span role="alert" className="ml-2 text-xs text-destructive">
          {estado.error}
        </span>
      ) : null}
    </form>
  );
}
