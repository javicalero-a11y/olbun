'use client';

import { useEffect, useRef, useState } from 'react';

import { Logotipo } from '@/components/features/app/logotipo';

/**
 * The sign-in cover.
 *
 * The mark and the wordmark hold the first screen on their own; scrolling
 * fades them back and brings the sign-in panel forward. It is the one page a
 * customer sees before they are a customer, and it is worth the screen.
 *
 * Three things keep the effect from getting in the way of signing in, which is
 * what the page is actually for:
 *
 *  - **It degrades to nothing.** Without JavaScript both halves render at full
 *    opacity and the panel is a scroll away. Nothing here gates the form.
 *  - **Reduced motion means no motion.** `prefers-reduced-motion` skips the
 *    fade and the scroll hint entirely rather than shortening them.
 *  - **Focus wins over the animation.** Tabbing into the panel while it is
 *    still faded pins it visible, so a keyboard user can never be typing into
 *    something they cannot see.
 */

/** How much of the viewport you scroll through before the cover is gone. */
const RECORRIDO = 0.7;

function progresoDe(desplazamiento: number, alto: number): number {
  if (alto <= 0) return 0;
  return Math.min(1, Math.max(0, desplazamiento / (alto * RECORRIDO)));
}

export function PortadaAcceso({ children }: Readonly<{ children: React.ReactNode }>) {
  // Starts at 1 so the server-rendered markup is the readable, un-animated
  // version; the first frame in the browser corrects it.
  const [progreso, setProgreso] = useState(0);
  const [animar, setAnimar] = useState(false);
  const [fijado, setFijado] = useState(false);
  const pendiente = useRef(false);

  useEffect(() => {
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (sinMovimiento.matches) return;

    setAnimar(true);

    function medir() {
      pendiente.current = false;
      setProgreso(progresoDe(window.scrollY, window.innerHeight));
    }

    function alDesplazar() {
      if (pendiente.current) return;
      pendiente.current = true;
      requestAnimationFrame(medir);
    }

    medir();
    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar, { passive: true });

    return () => {
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, []);

  const opacidadPortada = animar ? 1 - progreso : 1;
  // The panel comes up as the cover goes down, overlapping in the middle so
  // the screen is never empty.
  const opacidadPanel =
    !animar || fijado ? 1 : Math.min(1, Math.max(0, (progreso - 0.15) / 0.5));

  return (
    <>
      <section
        aria-hidden={animar && progreso > 0.95 ? 'true' : undefined}
        style={
          animar
            ? {
                opacity: opacidadPortada,
                transform: `scale(${String(1 - progreso * 0.06)})`,
                pointerEvents: progreso > 0.9 ? 'none' : undefined,
              }
            : undefined
        }
        className="sticky top-0 flex h-dvh flex-col items-center justify-center px-6 text-center will-change-[opacity,transform]"
      >
        <Logotipo tamano="portada" />

        <p className="mt-8 max-w-md text-base text-balance text-muted-foreground sm:text-lg">
          Contratos, plazos y expedientes del sector público, con las fechas bien contadas.
        </p>

        <a
          href="#acceso"
          className="mt-14 inline-flex flex-col items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Entrar
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className={`h-5 w-5 ${animar ? 'animate-bounce' : ''}`}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
          </svg>
        </a>
      </section>

      <main
        id="acceso"
        onFocus={() => {
          setFijado(true);
        }}
        style={animar ? { opacity: opacidadPanel } : undefined}
        className="relative flex min-h-dvh items-start justify-center px-6 pt-8 pb-24 will-change-[opacity]"
      >
        <div className="w-full max-w-sm rounded-xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          {children}
        </div>
      </main>
    </>
  );
}
