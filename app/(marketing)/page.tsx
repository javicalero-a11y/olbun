import type { Metadata } from 'next';
import Link from 'next/link';

import { Logotipo } from '@/components/features/app/logotipo';

export const metadata: Metadata = {
  title: 'Olbun — riesgo, incidencias y litigios para contratistas públicos',
};

const pilares = [
  {
    titulo: 'Cada plazo, bien calculado',
    cuerpo:
      'Días hábiles conforme a la Ley 39/2015, con el calendario laboral de la comunidad y el municipio que corresponden. Cada cálculo cita su fundamento para que puedas comprobarlo.',
  },
  {
    titulo: 'Cada expediente, con su cronología',
    cuerpo:
      'Del requerimiento a la resolución: hitos, plazos y actuaciones en una línea temporal que se genera sola a partir del tipo de procedimiento.',
  },
  {
    titulo: 'Cada señal, antes del litigio',
    cuerpo:
      'La correspondencia y los datos de plantilla se revisan buscando lo que precede a una reclamación. Nada se da por cierto sin que una persona lo confirme.',
  },
];

/**
 * The public front page.
 *
 * It carried no links at all until somebody landed on it and had no way to
 * reach the product — you had to know to type `/acceso`. A marketing page
 * whose only job is to send people into the application should say so above
 * the fold and again at the end.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-24">
      <header className="mb-14 flex items-center justify-between gap-4">
        <Logotipo />

        <nav aria-label="Acceso" className="flex items-center gap-4 text-sm">
          <Link href="/acceso" className="font-medium underline-offset-4 hover:underline">
            Entrar
          </Link>
          <Link
            href="/registro"
            className="rounded-md border border-input px-3 py-1.5 font-medium transition-colors hover:bg-accent"
          >
            Crear cuenta
          </Link>
        </nav>
      </header>

      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Ni un vencimiento perdido.
      </h1>
      <p className="mt-5 text-lg text-pretty text-muted-foreground">
        Riesgo, incidencias y litigios para empresas que prestan servicios al sector público.
      </p>

      <dl className="mt-14 grid gap-8 sm:grid-cols-3">
        {pilares.map((pilar) => (
          <div key={pilar.titulo}>
            <dt className="text-sm font-semibold">{pilar.titulo}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {pilar.cuerpo}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-14 text-sm">
        <Link href="/acceso" className="font-medium underline underline-offset-4">
          Entrar en tu espacio de trabajo
        </Link>
        <span className="text-muted-foreground">
          {' '}
          — o{' '}
          <Link href="/registro" className="underline underline-offset-4">
            crear una cuenta
          </Link>
          .
        </span>
      </p>
    </main>
  );
}
