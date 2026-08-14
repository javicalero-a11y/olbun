'use client';

import { useActionState } from 'react';

import type { EstadoComunicaciones } from '@/app/(app)/[orgSlug]/comunicaciones/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoComunicaciones = {};

/**
 * Uploading an exported message or a PDF copy of one.
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
          Correo o PDF
        </label>
        <input
          id="archivo"
          name="archivo"
          type="file"
          accept=".eml,.msg,.pdf,message/rfc822,application/vnd.ms-outlook,application/pdf"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
          aria-describedby="archivo-ayuda"
        />
        <p id="archivo-ayuda" className="text-xs text-muted-foreground">
          Admite .eml, .msg de Outlook y PDF. Se conserva el archivo original con su huella; si
          ya está en la bandeja, no se duplica.
        </p>
        {estado.errores?.['archivo']?.length ? (
          <p role="alert" className="text-xs text-destructive">
            {estado.errores['archivo'][0]}
          </p>
        ) : null}
      </div>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium">Sólo cuando el archivo es un PDF</legend>
        <p className="mb-3 text-xs text-muted-foreground">
          Un PDF no trae las cabeceras del correo. Indica quién lo envió; el asunto es opcional.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="remitentePdf" className="block text-sm font-medium">
              Remitente del PDF
            </label>
            <input
              id="remitentePdf"
              name="remitentePdf"
              type="text"
              placeholder="contratacion@ayuntamiento.es"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="asuntoPdf" className="block text-sm font-medium">
              Asunto del PDF
            </label>
            <input
              id="asuntoPdf"
              name="asuntoPdf"
              type="text"
              placeholder="Se usa el nombre del archivo si se deja vacío"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </fieldset>

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
