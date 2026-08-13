'use client';

import { useState, useTransition } from 'react';

import type { EstadoRetencion } from '@/app/(app)/[orgSlug]/documentos/retencion/acciones';

/**
 * The purge list.
 *
 * A client component for one reason: the row disappears when the purge
 * succeeds, so the confirmation has to be reported upward to a banner that
 * outlives it. Doing that with `useActionState` on the row loses the message —
 * the row unmounts in the same commit the result arrives in.
 *
 * The confirmation box is deliberate friction. Everything else in Olbun is
 * recoverable; this is the one action that destroys bytes.
 */

export interface FilaPurga {
  id: string;
  nombre: string;
  tipoNombre: string | null;
  versiones: number;
  caducoEl: string;
  explicacion: string;
}

type Accion = (previo: EstadoRetencion, formData: FormData) => Promise<EstadoRetencion>;

export function ListaPurga({
  filas,
  purgar,
  vacio,
}: {
  filas: FilaPurga[];
  purgar: Accion;
  vacio: React.ReactNode;
}) {
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(formData: FormData) {
    iniciar(async () => {
      const resultado = await purgar({}, formData);

      if (resultado.exito) {
        setAviso(resultado.exito);
        setError(null);
        setAbierta(null);
        return;
      }

      setError(
        resultado.error ?? resultado.errores?.['confirmacion']?.[0] ?? 'No se pudo purgar.',
      );
    });
  }

  return (
    <div>
      {aviso ? (
        <p role="status" className="mb-4 rounded-md bg-muted px-4 py-3 text-sm">
          {aviso}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      {filas.length === 0 ? (
        vacio
      ) : (
        <ul className="space-y-3">
          {filas.map((fila) => (
            <li key={fila.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{fila.nombre}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {fila.tipoNombre ?? 'Sin tipo'} · {fila.versiones}{' '}
                    {fila.versiones === 1 ? 'versión' : 'versiones'} · caducó el {fila.caducoEl}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{fila.explicacion}</p>
                </div>

                {abierta === fila.id ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      setAbierta(fila.id);
                    }}
                    className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted"
                  >
                    Purgar…
                  </button>
                )}
              </div>

              {abierta === fila.id ? (
                <form action={enviar} className="mt-4 border-t border-border pt-4">
                  <input type="hidden" name="documentoId" value={fila.id} />
                  <p className="text-sm">
                    Se borrarán el documento y sus {fila.versiones}{' '}
                    {fila.versiones === 1 ? 'versión' : 'versiones'}, ficheros incluidos. Queda
                    constancia en la auditoría de que existió y de quién lo purgó, pero{' '}
                    <strong>el contenido no se puede recuperar</strong>.
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label
                        htmlFor={`confirmacion-${fila.id}`}
                        className="block text-sm font-medium"
                      >
                        Escribe PURGAR para confirmar
                      </label>
                      <input
                        id={`confirmacion-${fila.id}`}
                        name="confirmacion"
                        autoComplete="off"
                        className="mt-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={pendiente}
                      className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                    >
                      {pendiente ? 'Purgando…' : 'Purgar definitivamente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAbierta(null);
                        setError(null);
                      }}
                      className="rounded-md px-3 py-2 text-sm hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
