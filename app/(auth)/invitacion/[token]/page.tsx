import type { Metadata } from 'next';
import Link from 'next/link';

import { ETIQUETA_ROL } from '@/lib/auth/etiquetas';
import { leerInvitacion } from '@/lib/services/invitaciones';
import { FormularioInvitacion } from '@/components/features/auth/formulario-aceptar-invitacion';
import { PanelAuth } from '@/components/features/auth/panel';
import { aceptar } from '../../acciones';

export const metadata: Metadata = { title: 'Invitación' };

export default async function InvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitacion = await leerInvitacion(token);

  if (!invitacion) {
    return (
      <PanelAuth>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold tracking-tight">Invitación no válida</h1>
          <p className="text-sm text-muted-foreground">
            Este enlace ha caducado o ya se ha utilizado. Pide a quien te invitó que te envíe
            uno nuevo.
          </p>
          <p className="text-sm">
            <Link href="/acceso" className="font-medium underline underline-offset-4">
              Ir al acceso
            </Link>
          </p>
        </div>
      </PanelAuth>
    );
  }

  return (
    <PanelAuth>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Te han invitado a {invitacion.organisationName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Como{' '}
            <span className="font-medium text-foreground">{ETIQUETA_ROL[invitacion.role]}</span>
            , con la dirección {invitacion.email}.
          </p>
        </div>

        <FormularioInvitacion
          token={token}
          necesitaContrasena={invitacion.necesitaContrasena}
          accion={aceptar}
        />
      </div>
    </PanelAuth>
  );
}
