import type { Metadata } from 'next';

import { requireSession } from '@/lib/auth/guardias';
import { requiereMfaObligatoria } from '@/lib/auth/mfa';
import { identityClientBecause } from '@/lib/db/tenant';
import { PanelMfa } from '@/components/features/ajustes/panel-mfa';
import { confirmarAltaMfa, desactivarMfa, iniciarAltaMfa } from '../acciones';

export const metadata: Metadata = { title: 'Seguridad' };

export default async function SeguridadPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requireSession(orgSlug);

  const db = identityClientBecause('two-factor settings live on the global user record');
  const usuario = await db.user.findUnique({
    where: { id: contexto.user.id },
    select: { mfaEnabled: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Verificación en dos pasos</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Un segundo factor para tu cuenta, además de la contraseña.
        </p>
      </div>

      <PanelMfa
        activada={usuario?.mfaEnabled ?? false}
        obligatoria={requiereMfaObligatoria(contexto.actor.role)}
        iniciar={iniciarAltaMfa.bind(null, orgSlug)}
        confirmar={confirmarAltaMfa.bind(null, orgSlug)}
        desactivar={desactivarMfa.bind(null, orgSlug)}
      />
    </div>
  );
}
