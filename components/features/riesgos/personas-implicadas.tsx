'use client';

import { useActionState } from 'react';

import type { EstadoIncidencias } from '@/app/(app)/[orgSlug]/incidencias/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoIncidencias = {};

export function PersonasImplicadas({
  incidenciaId,
  texto,
  editable,
  accion,
}: {
  incidenciaId: string;
  texto: string | null;
  editable: boolean;
  accion: (previo: EstadoIncidencias, datos: FormData) => Promise<EstadoIncidencias>;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <section className="rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">Personas implicadas — acceso restringido</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Contenido cifrado. Cada lectura queda registrada en auditoría.
      </p>
      {editable ? (
        <form action={enviar} className="mt-4 space-y-3">
          <input type="hidden" name="incidenciaId" value={incidenciaId} />
          <ErrorGeneral mensaje={estado.error} />
          {estado.exito ? (
            <p
              role="status"
              className="rounded-md bg-status-green-subtle px-3 py-2 text-sm text-status-green"
            >
              {estado.exito}
            </p>
          ) : null}
          <label htmlFor="personasImplicadas" className="block text-sm font-medium">
            Identidad, papel y circunstancias estrictamente necesarias
          </label>
          <textarea
            id="personasImplicadas"
            name="personasImplicadas"
            defaultValue={texto ?? ''}
            required
            maxLength={4000}
            className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="max-w-xs">
            <BotonEnviar pendiente={pendiente}>Guardar datos protegidos</BotonEnviar>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm whitespace-pre-wrap">{texto ?? 'Sin datos registrados.'}</p>
      )}
    </section>
  );
}
