'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

/**
 * The section navigation, down the left.
 *
 * Off-canvas below `lg` rather than hidden: a phone with no way to reach
 * Plazos is a phone that cannot tell you what expires today. The toggle lives
 * in the top bar and drives this through the same state.
 *
 * The current section is marked with `aria-current` as well as with colour —
 * status is never carried by colour alone (AGENTS.md).
 */

export interface Seccion {
  titulo: string;
  ruta: string;
}

export function BarraLateral({
  orgSlug,
  secciones,
  abierta,
  alCerrar,
}: {
  orgSlug: string;
  secciones: Seccion[];
  abierta: boolean;
  alCerrar: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Scrim, only while the drawer is open on a small screen. */}
      {abierta ? (
        <button
          type="button"
          aria-label="Cerrar el menú"
          onClick={alCerrar}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-border bg-card transition-transform lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100dvh-3.5rem)] lg:translate-x-0 ${
          abierta ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <nav aria-label="Secciones" className="flex h-full flex-col gap-1 overflow-y-auto p-3">
          {secciones.map((seccion) => {
            const destino = `/${orgSlug}/${seccion.ruta}`;
            const activa = pathname === destino || pathname.startsWith(`${destino}/`);

            return (
              <Link
                key={seccion.ruta}
                href={destino}
                onClick={alCerrar}
                aria-current={activa ? 'page' : undefined}
                className={`rounded-md px-3 py-2 text-sm transition-colors ${
                  activa
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                }`}
              >
                {seccion.titulo}
              </Link>
            );
          })}

          <Link
            href={`/${orgSlug}/ajustes`}
            onClick={alCerrar}
            className="mt-auto rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            Ajustes
          </Link>
        </nav>
      </aside>
    </>
  );
}

/**
 * The whole authenticated frame: top bar, sidebar, content.
 *
 * One client component rather than three, because the toggle lives in the bar
 * and the drawer it opens lives in the row below — they need the same piece of
 * state, and threading it through a context would be more machinery than a
 * single `useState` deserves. Everything inside is server-rendered and passed
 * in, so this holds no data of its own.
 */
export function MarcoApp({
  orgSlug,
  secciones,
  barra,
  children,
}: {
  orgSlug: string;
  secciones: Seccion[];
  /** Server-rendered contents of the top bar, right of the toggle. */
  barra: React.ReactNode;
  children: React.ReactNode;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-card">
        <div className="flex h-full items-center gap-2 px-4">
          <button
            type="button"
            onClick={() => {
              setAbierta((previa) => !previa);
            }}
            aria-expanded={abierta}
            aria-label={abierta ? 'Cerrar el menú' : 'Abrir el menú'}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground lg:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              className="h-5 w-5"
            >
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          {barra}
        </div>
      </header>

      <div className="flex flex-1">
        <BarraLateral
          orgSlug={orgSlug}
          secciones={secciones}
          abierta={abierta}
          alCerrar={() => {
            setAbierta(false);
          }}
        />

        <main className="min-w-0 flex-1 bg-muted/30 px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
