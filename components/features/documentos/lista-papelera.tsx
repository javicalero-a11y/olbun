'use client';

import { useState, useTransition } from 'react';

import type { EstadoDocumentos } from '@/app/(app)/[orgSlug]/documentos/acciones';

type Accion = (previo: EstadoDocumentos, formData: FormData) => Promise<EstadoDocumentos>;

export function ListaPapelera({
  documentos,
  restaurar,
  destinoRestaurado,
}: {
  documentos: {
    id: string;
    nombre: string;
    motivo: string;
    borradoEl: string;
    versiones: number;
  }[];
  restaurar: Accion;
  destinoRestaurado: string;
}) {
  const [mensaje, setMensaje] = useState<EstadoDocumentos>({});
  const [pendiente, iniciar] = useTransition();

  function enviar(formData: FormData) {
    iniciar(async () => {
      const resultado = await restaurar({}, formData);
      setMensaje(resultado);
      if (resultado.exito) {
        window.location.assign(destinoRestaurado);
      }
    });
  }

  if (documentos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-8 text-sm text-muted-foreground">
        La papelera está vacía.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {mensaje.exito ? (
        <p role="status" className="rounded-md bg-muted px-4 py-3 text-sm">
          {mensaje.exito}
        </p>
      ) : null}
      {mensaje.error ? (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {mensaje.error}
        </p>
      ) : null}
      <ul className="space-y-3">
        {documentos.map((documento) => (
          <li
            key={documento.id}
            className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border p-4"
          >
            <div>
              <p className="text-sm font-medium">{documento.nombre}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {documento.versiones} {documento.versiones === 1 ? 'versión' : 'versiones'} ·
                eliminado el {documento.borradoEl}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">Motivo: {documento.motivo}</p>
            </div>
            <form action={enviar}>
              <input type="hidden" name="documentoId" value={documento.id} />
              <button
                disabled={pendiente}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                Restaurar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
