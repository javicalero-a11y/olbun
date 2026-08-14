'use client';

import { useActionState } from 'react';

import type { EstadoAlias } from '@/app/(app)/[orgSlug]/comunicaciones/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoAlias = {};

export function PanelAlias({
  accion,
  aliases,
  contratos,
  operativo,
}: {
  accion: (previo: EstadoAlias, formData: FormData) => Promise<EstadoAlias>;
  aliases: { id: string; direccion: string; contrato: string | null }[];
  contratos: { id: string; etiqueta: string }[];
  operativo: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Alias de reenvío</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Reenvía un correo a una de estas direcciones y Olbun lo incorpora sin duplicarlo.
          {!operativo
            ? ' El webhook está cerrado hasta configurar INBOUND_EMAIL_SECRET en el despliegue.'
            : ''}
        </p>
      </div>

      {aliases.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {aliases.map((alias) => (
            <li key={alias.id} className="rounded-md bg-secondary/50 px-3 py-2">
              <code className="text-xs break-all">{alias.direccion}</code>
              <span className="ml-2 text-xs text-muted-foreground">
                {alias.contrato ?? 'General'}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={enviar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <ErrorGeneral mensaje={estado.error} />
        <div className="min-w-0 flex-1 space-y-1.5">
          <label htmlFor="alias-contrato" className="block text-sm font-medium">
            Vincular el nuevo alias
          </label>
          <select
            id="alias-contrato"
            name="contratoId"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Bandeja general</option>
            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <BotonEnviar pendiente={pendiente}>Crear alias</BotonEnviar>
      </form>

      {estado.exito ? (
        <p role="status" className="text-xs text-status-green">
          {estado.exito}
        </p>
      ) : null}
    </section>
  );
}
