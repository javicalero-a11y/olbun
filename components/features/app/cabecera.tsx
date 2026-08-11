import Link from 'next/link';

import { cerrarSesion } from '@/app/(app)/acciones';
import type { Role } from '@prisma/client';

const ETIQUETA_ROL: Record<Role, string> = {
  OWNER: 'Propietario',
  ORG_ADMIN: 'Administración',
  GESTOR_CONTRATO: 'Responsable de contrato',
  JURIDICO: 'Asesoría jurídica',
  LETRADO_EXTERNO: 'Letrado externo',
  CALIDAD: 'Calidad y PRL',
  RRHH: 'RRHH',
  ADMIN_CONTABLE: 'Administración contable',
  CONTRIBUTOR: 'Colaborador',
  VIEWER: 'Sólo lectura',
};

interface CabeceraProps {
  organisation: { slug: string; name: string };
  organisations: { slug: string; name: string; role: Role }[];
  user: { name: string; email: string };
  rol: Role;
}

export function CabeceraApp({ organisation, organisations, user, rol }: CabeceraProps) {
  const otras = organisations.filter((o) => o.slug !== organisation.slug);

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={`/${organisation.slug}`}
            className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
          >
            Olbun
          </Link>
          <span className="text-border" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-medium">{organisation.name}</span>
        </div>

        <div className="flex items-center gap-4">
          {otras.length > 0 ? (
            <nav aria-label="Cambiar de organización" className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Cambiar a:</span>
              {otras.map((o) => (
                <Link
                  key={o.slug}
                  href={`/${o.slug}`}
                  className="text-xs underline underline-offset-4"
                >
                  {o.name}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="text-right">
            <p className="text-sm leading-tight font-medium">{user.name}</p>
            <p className="text-xs leading-tight text-muted-foreground">{ETIQUETA_ROL[rol]}</p>
          </div>

          <form action={cerrarSesion}>
            <button
              type="submit"
              className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Salir
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
