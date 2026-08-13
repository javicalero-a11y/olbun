'use client';

import { useActionState } from 'react';

import type { EstadoDocumentos } from '@/app/(app)/[orgSlug]/documentos/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoDocumentos = {};

/**
 * Uploading a document.
 *
 * Classifying it is offered at upload rather than left for later, because the
 * person with the file in front of them is the one who knows what it is, and
 * an unclassified document has no retention policy — which is the whole point
 * of having types at all.
 */
export function FormularioSubidaDocumento({
  accion,
  tipos,
  expedientes,
  documentos,
}: {
  accion: (previo: EstadoDocumentos, formData: FormData) => Promise<EstadoDocumentos>;
  tipos: { id: string; nombre: string }[];
  expedientes: { id: string; etiqueta: string }[];
  /** Existing documents, so an upload can be a new version of one. */
  documentos: { id: string; etiqueta: string }[];
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
          Archivo
        </label>
        <input
          id="archivo"
          name="archivo"
          type="file"
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm"
          aria-describedby="archivo-ayuda"
        />
        <p id="archivo-ayuda" className="text-xs text-muted-foreground">
          Hasta 50 MB. Subir el mismo nombre otra vez crea una versión nueva; la anterior se
          conserva.
        </p>
        {estado.errores?.['archivo']?.[0] ? (
          <p className="text-xs text-destructive">{estado.errores['archivo'][0]}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="tipoId" className="block text-sm font-medium">
            Tipo documental
          </label>
          <select
            id="tipoId"
            name="tipoId"
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-describedby="tipo-ayuda"
          >
            <option value="">Sin clasificar</option>
            {tipos.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nombre}
              </option>
            ))}
          </select>
          <p id="tipo-ayuda" className="text-xs text-muted-foreground">
            De aquí sale cuánto tiempo hay que conservarlo.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="expedienteId" className="block text-sm font-medium">
            Expediente
          </label>
          <select
            id="expedienteId"
            name="expedienteId"
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Sin vincular</option>
            {expedientes.map((expediente) => (
              <option key={expediente.id} value={expediente.id}>
                {expediente.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      {documentos.length > 0 ? (
        <div className="space-y-1.5">
          <label htmlFor="documentoId" className="block text-sm font-medium">
            ¿Es una versión nueva de algo?
          </label>
          <select
            id="documentoId"
            name="documentoId"
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            aria-describedby="version-ayuda"
          >
            <option value="">No, es un documento nuevo</option>
            {documentos.map((documento) => (
              <option key={documento.id} value={documento.id}>
                {documento.etiqueta}
              </option>
            ))}
          </select>
          <p id="version-ayuda" className="text-xs text-muted-foreground">
            La versión anterior se conserva entera; no se sustituye nada.
          </p>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="descripcion" className="block text-sm font-medium">
          Descripción
        </label>
        <input
          id="descripcion"
          name="descripcion"
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <BotonEnviar pendiente={pendiente}>Subir documento</BotonEnviar>
    </form>
  );
}
