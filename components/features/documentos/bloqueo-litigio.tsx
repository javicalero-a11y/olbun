'use client';

import { useState, useTransition } from 'react';

import type { EstadoBloqueo } from '@/app/(app)/[orgSlug]/documentos/bloqueo';

/**
 * The litigation-hold control for one document row.
 *
 * Asks for a reason before it will do anything in either direction. A hold is a
 * statement that a document is evidence in a live dispute, and "why is this
 * file untouchable" is the first question anybody asks a year later — a
 * checkbox cannot answer it.
 */

type Accion = (previo: EstadoBloqueo, formData: FormData) => Promise<EstadoBloqueo>;

export function BloqueoLitigio({
  documentoId,
  nombre,
  bloqueado,
  puedeLevantar,
  accion,
}: {
  documentoId: string;
  nombre: string;
  bloqueado: boolean;
  /** Lifting a hold takes the delete permission; placing one does not. */
  puedeLevantar: boolean;
  accion: Accion;
}) {
  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (bloqueado && !puedeLevantar) {
    return <span className="text-status-amber">Bloqueado por litigio</span>;
  }

  function enviar(formData: FormData) {
    iniciar(async () => {
      const resultado = await accion({}, formData);

      if (resultado.exito) {
        setAbierto(false);
        setError(null);
        return;
      }

      setError(resultado.error ?? resultado.errores?.['motivo']?.[0] ?? 'No se pudo cambiar.');
    });
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
        }}
        className="text-left underline underline-offset-4"
      >
        {bloqueado ? (
          <span className="text-status-amber">Bloqueado por litigio</span>
        ) : (
          <span>Bloquear por litigio</span>
        )}
      </button>
    );
  }

  return (
    <form action={enviar} className="space-y-2">
      <input type="hidden" name="documentoId" value={documentoId} />
      <input type="hidden" name="bloquear" value={bloqueado ? 'false' : 'true'} />

      <label htmlFor={`motivo-${documentoId}`} className="block">
        {bloqueado
          ? `Por qué se levanta el bloqueo de «${nombre}»`
          : `Por qué se bloquea «${nombre}»`}
      </label>
      <input
        id={`motivo-${documentoId}`}
        name="motivo"
        autoComplete="off"
        className="w-full rounded-md border border-border bg-background px-2 py-1"
      />

      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md border border-border px-2 py-1 font-medium disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : bloqueado ? 'Levantar' : 'Bloquear'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
          }}
          className="rounded-md px-2 py-1"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
