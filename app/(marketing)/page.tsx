import type { Metadata } from 'next';

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

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-6 py-24">
      <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">Olbun</p>
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

      <p className="mt-14 text-xs text-muted-foreground">
        Hito M0 — fundación. El acceso llega en M1.
      </p>
    </main>
  );
}
