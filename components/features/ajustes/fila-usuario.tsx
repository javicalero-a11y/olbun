'use client';

import { useTransition } from 'react';
import type { MembershipStatus, Role } from '@prisma/client';

import type { EstadoAjustes } from '@/app/(app)/[orgSlug]/ajustes/acciones';
import { ETIQUETA_ESTADO, ETIQUETA_ROL } from '@/lib/auth/etiquetas';
import { ROLES_INVITABLES } from './formulario-invitacion';

export interface UsuarioFila {
  membershipId: string;
  nombre: string;
  email: string;
  role: Role;
  status: MembershipStatus;
  esUnoMismo: boolean;
}

export function FilaUsuario({
  usuario,
  puedeCambiarRol,
  puedeSuspender,
  onCambiarRol,
  onCambiarEstado,
}: {
  usuario: UsuarioFila;
  puedeCambiarRol: boolean;
  puedeSuspender: boolean;
  onCambiarRol: (membershipId: string, role: Role) => Promise<EstadoAjustes>;
  onCambiarEstado: (membershipId: string, suspender: boolean) => Promise<EstadoAjustes>;
}) {
  const [pendiente, startTransition] = useTransition();
  const estado = ETIQUETA_ESTADO[usuario.status];

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 pr-4">
        <p className="text-sm font-medium">{usuario.nombre}</p>
        <p className="text-xs text-muted-foreground">{usuario.email}</p>
      </td>

      <td className="py-3 pr-4">
        {/* Status is never colour alone — the label carries the meaning. */}
        <span className={`text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
      </td>

      <td className="py-3 pr-4">
        {puedeCambiarRol && usuario.role !== 'OWNER' ? (
          <>
            <label htmlFor={`rol-${usuario.membershipId}`} className="sr-only">
              Rol de {usuario.nombre}
            </label>
            <select
              id={`rol-${usuario.membershipId}`}
              defaultValue={usuario.role}
              disabled={pendiente}
              onChange={(e) => {
                const role = e.target.value as Role;
                startTransition(async () => {
                  await onCambiarRol(usuario.membershipId, role);
                });
              }}
              className="rounded-md border border-input bg-background px-2 py-1 text-xs"
            >
              {ROLES_INVITABLES.map((r) => (
                <option key={r.valor} value={r.valor}>
                  {r.etiqueta}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">{ETIQUETA_ROL[usuario.role]}</span>
        )}
      </td>

      <td className="py-3 text-right">
        {puedeSuspender && !usuario.esUnoMismo && usuario.status !== 'INVITED' ? (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              startTransition(async () => {
                await onCambiarEstado(usuario.membershipId, usuario.status === 'ACTIVE');
              });
            }}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground disabled:opacity-50"
          >
            {usuario.status === 'ACTIVE' ? 'Suspender' : 'Restablecer'}
          </button>
        ) : null}
      </td>
    </tr>
  );
}
