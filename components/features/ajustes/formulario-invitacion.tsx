'use client';

import { useActionState } from 'react';

import type { EstadoAjustes } from '@/app/(app)/[orgSlug]/ajustes/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoAjustes = {};

export const ROLES_INVITABLES = [
  { valor: 'GESTOR_CONTRATO', etiqueta: 'Responsable de contrato' },
  { valor: 'JURIDICO', etiqueta: 'Asesoría jurídica' },
  { valor: 'LETRADO_EXTERNO', etiqueta: 'Letrado externo' },
  { valor: 'CALIDAD', etiqueta: 'Calidad y PRL' },
  { valor: 'RRHH', etiqueta: 'RRHH' },
  { valor: 'ADMIN_CONTABLE', etiqueta: 'Administración contable' },
  { valor: 'CONTRIBUTOR', etiqueta: 'Colaborador' },
  { valor: 'VIEWER', etiqueta: 'Sólo lectura' },
  { valor: 'ORG_ADMIN', etiqueta: 'Administración' },
] as const;

export function FormularioInvitacion({
  accion,
}: {
  accion: (previo: EstadoAjustes, formData: FormData) => Promise<EstadoAjustes>;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className="space-y-4" noValidate>
      <ErrorGeneral mensaje={estado.error} />

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-status-green/30 bg-status-green-subtle px-3 py-2 text-sm text-status-green"
        >
          {estado.exito}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Campo
          etiqueta="Correo electrónico"
          nombre="email"
          type="email"
          autoComplete="off"
          required
          errores={estado.errores?.['email']}
        />

        <div className="space-y-1.5">
          <label htmlFor="role" className="block text-sm font-medium">
            Rol
          </label>
          <select
            id="role"
            name="role"
            defaultValue="VIEWER"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {ROLES_INVITABLES.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-w-40">
        <BotonEnviar pendiente={pendiente}>Invitar</BotonEnviar>
      </div>
    </form>
  );
}
