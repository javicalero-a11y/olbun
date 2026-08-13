import type { Metadata } from 'next';
import Link from 'next/link';

import { FormularioAcceso } from '@/components/features/auth/formulario-acceso';
import { OtrosAccesos } from '@/components/features/auth/otros-accesos';
import { PortadaAcceso } from '@/components/features/auth/portada-acceso';
import { MENSAJE_RECHAZO, type MotivoRechazo } from '@/lib/auth/politica-acceso';
import { estadoGoogle, estadoMicrosoft } from '@/lib/auth/proveedores';

export const metadata: Metadata = { title: 'Entrar' };

export default async function AccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;

  // Set by the signIn callback when a Google or magic-link attempt was
  // refused, so the person gets a sentence instead of a generic failure.
  const rechazo =
    motivo && motivo in MENSAJE_RECHAZO ? MENSAJE_RECHAZO[motivo as MotivoRechazo] : null;

  return (
    <PortadaAcceso>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-muted-foreground">Accede a tu espacio de trabajo.</p>
        </div>

        {rechazo ? (
          <p
            role="alert"
            className="rounded-md border border-status-amber/30 bg-status-amber-subtle px-3 py-2.5 text-sm"
          >
            {rechazo}
          </p>
        ) : null}

        <FormularioAcceso />

        <OtrosAccesos google={estadoGoogle()} microsoft={estadoMicrosoft()} />

        <p className="text-sm text-muted-foreground">
          ¿No tienes cuenta?{' '}
          <Link
            href="/registro"
            className="font-medium text-foreground underline underline-offset-4"
          >
            Crear una
          </Link>
        </p>
      </div>
    </PortadaAcceso>
  );
}
