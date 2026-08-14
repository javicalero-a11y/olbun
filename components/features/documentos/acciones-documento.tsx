'use client';

import { useState, useTransition } from 'react';

import type { EstadoDocumentos } from '@/app/(app)/[orgSlug]/documentos/acciones';

type Accion = (previo: EstadoDocumentos, formData: FormData) => Promise<EstadoDocumentos>;

export function AccionesDocumento({
  documentoId,
  versionId,
  bloqueado,
  estadoAnalisis,
  estadoIndexacion,
  puedeBloquear,
  puedeEliminar,
  ejecutarOcr,
  reanalizar,
  cambiarBloqueo,
  eliminar,
}: {
  documentoId: string;
  versionId: string;
  bloqueado: boolean;
  estadoAnalisis: string;
  estadoIndexacion: string;
  puedeBloquear: boolean;
  puedeEliminar: boolean;
  ejecutarOcr: Accion;
  reanalizar: Accion;
  cambiarBloqueo: Accion;
  eliminar: Accion;
}) {
  const [mensaje, setMensaje] = useState<EstadoDocumentos>({});
  const [pendiente, iniciar] = useTransition();

  function enviar(accion: Accion, formData: FormData) {
    iniciar(async () => setMensaje(await accion({}, formData)));
  }

  const requiereOcr = ['OCR_PENDIENTE', 'OCR_PARCIAL', 'ERROR'].includes(estadoIndexacion);

  return (
    <div className="min-w-40 space-y-2 text-xs">
      {mensaje.exito ? (
        <p className="text-status-green" role="status">
          {mensaje.exito}
        </p>
      ) : null}
      {mensaje.error ? (
        <p className="text-destructive" role="alert">
          {mensaje.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {estadoAnalisis !== 'LIMPIO' ? (
          <form action={enviar.bind(null, reanalizar)}>
            <input type="hidden" name="versionId" value={versionId} />
            <button
              className="rounded border border-border px-2 py-1 hover:bg-muted"
              disabled={pendiente}
            >
              Reanalizar
            </button>
          </form>
        ) : null}
        {estadoAnalisis === 'LIMPIO' && requiereOcr ? (
          <form action={enviar.bind(null, ejecutarOcr)}>
            <input type="hidden" name="versionId" value={versionId} />
            <button
              className="rounded border border-border px-2 py-1 hover:bg-muted"
              disabled={pendiente}
            >
              Ejecutar OCR
            </button>
          </form>
        ) : null}
      </div>

      {puedeBloquear || puedeEliminar ? (
        <details>
          <summary className="cursor-pointer font-medium underline underline-offset-4">
            Gestionar
          </summary>
          <div className="mt-2 space-y-3 rounded border border-border bg-background p-2">
            {puedeBloquear ? (
              <form action={enviar.bind(null, cambiarBloqueo)} className="space-y-1.5">
                <input type="hidden" name="documentoId" value={documentoId} />
                <input type="hidden" name="bloquear" value={String(!bloqueado)} />
                <label htmlFor={`bloqueo-${documentoId}`} className="block font-medium">
                  Motivo para {bloqueado ? 'retirar' : 'aplicar'} el bloqueo
                </label>
                <textarea
                  id={`bloqueo-${documentoId}`}
                  name="motivo"
                  required
                  minLength={10}
                  rows={2}
                  className="w-full rounded border border-input bg-background p-1.5"
                />
                <button className="rounded border border-border px-2 py-1" disabled={pendiente}>
                  {bloqueado ? 'Retirar bloqueo' : 'Bloquear como evidencia'}
                </button>
              </form>
            ) : null}

            {puedeEliminar && !bloqueado ? (
              <form
                action={enviar.bind(null, eliminar)}
                className="space-y-1.5 border-t border-border pt-2"
              >
                <input type="hidden" name="documentoId" value={documentoId} />
                <label htmlFor={`borrar-${documentoId}`} className="block font-medium">
                  Motivo del borrado recuperable
                </label>
                <textarea
                  id={`borrar-${documentoId}`}
                  name="motivo"
                  required
                  minLength={10}
                  rows={2}
                  className="w-full rounded border border-input bg-background p-1.5"
                />
                <button
                  className="rounded border border-destructive px-2 py-1 text-destructive"
                  disabled={pendiente}
                >
                  Enviar a la papelera
                </button>
              </form>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}
