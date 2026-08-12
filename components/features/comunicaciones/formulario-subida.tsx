'use client';

import { useActionState } from 'react';

import type { EstadoComunicaciones } from '@/app/(app)/[orgSlug]/comunicaciones/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoComunicaciones = {};

/**
 * Uploading a `.eml`.
 *
 * Linking to a contract is offered here rather than left for later: the person
 * uploading is the one who knows which contract it belongs to, and a message
 * filed against nothing tends to stay filed against nothing.
 */
export function FormularioSubida({
  accion,
  contratos,
}: {
  accion: (previo: EstadoComunicaciones, formData: FormData) => Promise<EstadoComunicaciones>;
  contratos: { id: string; etiqueta: string }[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className="space-y-4 rounded-lg border border-border p-4">
      <ErrorGeneral mensaje={estado.error} />

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-status-green/30 bg-status-green-subtle px-3 py-2 text-sm text-status-green"
        >
          {estado.exito}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="archivo" className="block text-sm font-medium">
          Archivo .eml
        </label>
        <input
          id="archivo"
          name="archivo"
          type="file"
          accept=".eml,message/rfc822"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
          aria-describedby="archivo-ayuda"
        />
        <p id="archivo-ayuda" className="text-xs text-muted-foreground">
          Arrastra el correo desde Outlook o Apple Mail para obtener un .eml. Si ya lo tienes en
          la bandeja, no se duplica.
        </p>
        {estado.errores?.['archivo']?.length ? (
          <p role="alert" className="text-xs text-destructive">
            {estado.errores['archivo'][0]}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="direccion" className="block text-sm font-medium">
            Dirección
          </label>
          <select
            id="direccion"
            name="direccion"
            defaultValue="ENTRANTE"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="ENTRANTE">Recibido</option>
            <option value="SALIENTE">Enviado</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contratoId" className="block text-sm font-medium">
            Contrato
          </label>
          <select
            id="contratoId"
            name="contratoId"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin vincular</option>
            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <BotonEnviar pendiente={pendiente}>Añadir a la bandeja</BotonEnviar>
    </form>
  );
}
