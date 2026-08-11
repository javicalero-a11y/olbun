import type { Metadata } from 'next';
import Link from 'next/link';

import { FormularioRegistro } from '@/components/features/auth/formulario-registro';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function RegistroPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Crea tu cuenta</h1>
        <p className="text-sm text-muted-foreground">
          Empieza a controlar contratos, plazos y expedientes.
        </p>
      </div>

      <FormularioRegistro />

      <p className="text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{' '}
        <Link
          href="/acceso"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Entrar
        </Link>
      </p>
    </div>
  );
}
