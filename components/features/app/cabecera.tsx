import Link from 'next/link';

import { cerrarSesion } from '@/app/(app)/acciones';
import { CambiarTema } from './cambiar-tema';
import { ETIQUETA_ROL } from '@/lib/auth/etiquetas';
import { Logotipo } from './logotipo';
import type { Role } from '@prisma/client';
import type { Tema } from '@/lib/tema';

interface CabeceraProps {
  organisation: { slug: string; name: string };
  organisations: { slug: string; name: string; role: Role }[];
  user: { name: string; email: string };
  rol: Role;
  tema: Tema;
}

/** Modules that exist. Permission-gated pages 403 on their own if entered. */
const SECCIONES = [
  { titulo: 'Contratos', ruta: 'contratos' },
  { titulo: 'Expedientes', ruta: 'expedientes' },
  { titulo: 'Plazos', ruta: 'plazos' },
  { titulo: 'Comunicaciones', ruta: 'comunicaciones' },
  { titulo: 'Detecciones', ruta: 'detecciones' },
  { titulo: 'Incidencias', ruta: 'incidencias' },
  { titulo: 'Riesgos', ruta: 'riesgos' },
  { titulo: 'Documentos', ruta: 'documentos' },
];

export function CabeceraApp({ organisation, organisations, user, rol, tema }: CabeceraProps) {
  const otras = organisations.filter((o) => o.slug !== organisation.slug);

  return (
    <header className="border-b border-border bg-card/40">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link href={`/${organisation.slug}`} aria-label="Olbun, inicio">
            <Logotipo />
          </Link>
          <span className="text-border" aria-hidden="true">
            /
          </span>
          <span className="text-sm font-medium">{organisation.name}</span>

          {/* Wraps rather than hiding on narrow screens: a phone with no way to
              reach Plazos is a phone that cannot tell you what expires today. */}
          <nav
            aria-label="Secciones"
            className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 sm:ml-4 sm:w-auto"
          >
            {SECCIONES.map((seccion) => (
              <Link
                key={seccion.ruta}
                href={`/${organisation.slug}/${seccion.ruta}`}
                className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {seccion.titulo}
              </Link>
            ))}
          </nav>
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

          <CambiarTema tema={tema} />

          <Link
            href={`/${organisation.slug}/ajustes`}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Ajustes
          </Link>

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
