import type { Metadata } from 'next';
import Link from 'next/link';

import { FormularioAcceso } from '@/components/features/auth/formulario-acceso';

export const metadata: Metadata = { title: 'Entrar' };

export default function AccesoPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-sm text-muted-foreground">Accede a tu espacio de trabajo.</p>
      </div>

      <FormularioAcceso />

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
  );
}
