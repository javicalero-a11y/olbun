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
export const SECCIONES = [
  { titulo: 'Contratos', ruta: 'contratos' },
  { titulo: 'Expedientes', ruta: 'expedientes' },
  { titulo: 'Plazos', ruta: 'plazos' },
  { titulo: 'Comunicaciones', ruta: 'comunicaciones' },
  { titulo: 'Detecciones', ruta: 'detecciones' },
  { titulo: 'Incidencias', ruta: 'incidencias' },
  { titulo: 'Riesgos', ruta: 'riesgos' },
  { titulo: 'Personal', ruta: 'personal' },
  { titulo: 'Documentos', ruta: 'documentos' },
];

/**
 * The contents of the top bar.
 *
 * The search box goes to the document search, which reads names, descriptions
 * and extracted contents. It is pointed at something real on purpose: a search
 * field that looks global and only half-works teaches people not to trust the
 * results, which is worse than not offering one.
 */
export function CabeceraApp({ organisation, organisations, user, rol, tema }: CabeceraProps) {
  const otras = organisations.filter((o) => o.slug !== organisation.slug);

  return (
    <>
      <Link href={`/${organisation.slug}`} aria-label="Olbun, inicio" className="shrink-0">
        <Logotipo />
      </Link>

      <form
        action={`/${organisation.slug}/documentos`}
        role="search"
        className="relative mx-2 hidden min-w-0 flex-1 sm:block"
      >
        <label htmlFor="busqueda-global" className="sr-only">
          Búsqueda rápida de documentos en {organisation.name}
        </label>
        <input
          id="busqueda-global"
          name="q"
          type="search"
          placeholder="Buscar un documento por su nombre o por lo que dice"
          className="w-full rounded-full border border-input bg-background py-2 pr-10 pl-4 text-sm"
        />
        <button
          type="submit"
          aria-label="Buscar"
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            className="h-4 w-4"
          >
            <circle cx="11" cy="11" r="7" />
            <path strokeLinecap="round" d="m20 20-3.5-3.5" />
          </svg>
        </button>
      </form>

      <div className="ml-auto flex shrink-0 items-center gap-3">
        {otras.length > 0 ? (
          <nav
            aria-label="Cambiar de organización"
            className="hidden items-center gap-2 md:flex"
          >
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

        <div className="hidden text-right sm:block">
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
    </>
  );
}
