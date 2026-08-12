import Link from 'next/link';

import { Logotipo } from '@/components/features/app/logotipo';

/**
 * The signed-out shell.
 *
 * A single soft wash of the brand gradient sits behind the panel — the one
 * decorative use of it besides the marketing hero. It is a background, never a
 * surface for text: everything readable sits on the card above it, where the
 * contrast is known.
 */
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Decorative only, and kept away from assistive technology. */}
      <div
        aria-hidden="true"
        className="fondo-degradado pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full opacity-20 blur-3xl"
      />

      <header className="relative px-6 py-6">
        <Link href="/" aria-label="Olbun, inicio" className="inline-block">
          <Logotipo />
        </Link>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-6 pb-24">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card/70 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
