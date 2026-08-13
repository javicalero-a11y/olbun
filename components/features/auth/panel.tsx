import Link from 'next/link';

import { Logotipo } from '@/components/features/app/logotipo';

/**
 * The card the signed-out pages sit on.
 *
 * It used to live in the auth layout, which meant every page under it got the
 * same frame. `/acceso` now opens with a full-height cover instead, so the
 * card moved here and each page says whether it wants one.
 */
export function PanelAuth({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <header className="relative px-6 py-6">
        <Link href="/" aria-label="Olbun, inicio" className="inline-block">
          <Logotipo tamano="grande" />
        </Link>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-6 pb-24">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          {children}
        </div>
      </main>
    </>
  );
}
