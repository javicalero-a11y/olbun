import type { Metadata } from 'next';

import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { FormularioInvitacion } from '@/components/features/ajustes/formulario-invitacion';
import { FilaUsuario } from '@/components/features/ajustes/fila-usuario';
import { cambiarEstado, cambiarRol, invitar } from '../acciones';

export const metadata: Metadata = { title: 'Usuarios' };

export default async function UsuariosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'user:list');

  // Scoped client: the organisation filter is injected, and RLS enforces it a
  // second time at the database.
  const db = tenantClient(contexto.organisation.id);

  const miembros = await db.membership.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      role: true,
      status: true,
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
  });

  const puedeInvitar = can(contexto.actor, 'user:invite');
  const puedeCambiarRol = can(contexto.actor, 'user:update_role');
  const puedeSuspender = can(contexto.actor, 'user:suspend');

  const invitarAccion = invitar.bind(null, orgSlug);
  const cambiarRolAccion = cambiarRol.bind(null, orgSlug);
  const cambiarEstadoAccion = cambiarEstado.bind(null, orgSlug);

  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="equipo">
        <div>
          <h2 id="equipo" className="text-base font-semibold">
            Equipo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {miembros.length === 1
              ? 'Una persona con acceso.'
              : `${String(miembros.length)} personas con acceso.`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <caption className="sr-only">Personas con acceso a la organización</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Persona
                </th>
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Estado
                </th>
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Rol
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {miembros.map((m) => (
                <FilaUsuario
                  key={m.id}
                  usuario={{
                    membershipId: m.id,
                    nombre: m.user.name,
                    email: m.user.email,
                    role: m.role,
                    status: m.status,
                    esUnoMismo: m.user.id === contexto.user.id,
                  }}
                  puedeCambiarRol={puedeCambiarRol}
                  puedeSuspender={puedeSuspender}
                  onCambiarRol={cambiarRolAccion}
                  onCambiarEstado={cambiarEstadoAccion}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {puedeInvitar ? (
        <section className="space-y-4" aria-labelledby="invitar">
          <div>
            <h2 id="invitar" className="text-base font-semibold">
              Invitar a alguien
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recibirá un enlace de un solo uso, válido durante siete días.
            </p>
          </div>

          <FormularioInvitacion accion={invitarAccion} />
        </section>
      ) : null}
    </div>
  );
}
