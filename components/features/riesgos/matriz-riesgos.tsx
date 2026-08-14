import Link from 'next/link';

import {
  nivelDe,
  nombreDeNivel,
  type BandaMatriz,
  type Escala,
} from '@/lib/domain/riesgos/matriz';

const FONDO: Record<string, string> = {
  BAJO: 'bg-slate-100 dark:bg-slate-800/70',
  MEDIO: 'bg-amber-100 dark:bg-amber-950/50',
  ALTO: 'bg-red-100 dark:bg-red-950/50',
  MUY_ALTO: 'bg-red-200 ring-1 ring-inset ring-red-400 dark:bg-red-950 dark:ring-red-700',
};

export interface RiesgoEnMatriz {
  probabilidad: Escala;
  impacto: Escala;
  cantidad?: number;
}

export function MatrizRiesgos({
  riesgos,
  bandas,
  basePath,
}: {
  riesgos: readonly RiesgoEnMatriz[];
  bandas: readonly BandaMatriz[];
  basePath: string;
}) {
  const conteos = new Map<string, number>();
  for (const riesgo of riesgos) {
    const clave = `${String(riesgo.probabilidad)}-${String(riesgo.impacto)}`;
    conteos.set(clave, (conteos.get(clave) ?? 0) + (riesgo.cantidad ?? 1));
  }
  const probabilidades: Escala[] = [5, 4, 3, 2, 1];
  const impactos: Escala[] = [1, 2, 3, 4, 5];

  return (
    <section aria-labelledby="matriz-titulo" className="rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="matriz-titulo" className="text-sm font-semibold">
            Matriz del riesgo vigente
          </h2>
          <p className="text-xs text-muted-foreground">
            Residual cuando está valorado; inherente cuando todavía no lo está. Pulsa una celda
            para filtrar.
          </p>
        </div>
        <Link href={basePath} className="text-xs text-primary hover:underline">
          Quitar filtro
        </Link>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-separate border-spacing-1 text-center text-xs">
          <caption className="sr-only">
            Número de riesgos por probabilidad e impacto, con nivel escrito en cada celda
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-24 text-left font-medium text-muted-foreground">
                Prob. ↓ / Impacto →
              </th>
              {impactos.map((impacto) => (
                <th key={impacto} scope="col" className="font-medium">
                  {impacto}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probabilidades.map((probabilidad) => (
              <tr key={probabilidad}>
                <th scope="row" className="text-left font-medium">
                  {probabilidad}
                </th>
                {impactos.map((impacto) => {
                  const nivel = nivelDe(probabilidad, impacto, bandas);
                  const cantidad =
                    conteos.get(`${String(probabilidad)}-${String(impacto)}`) ?? 0;
                  return (
                    <td key={impacto} className="p-0.5">
                      <Link
                        href={`${basePath}?probabilidad=${String(probabilidad)}&impacto=${String(impacto)}`}
                        className={`flex min-h-16 flex-col items-center justify-center rounded-md px-2 py-1 transition hover:ring-2 hover:ring-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${FONDO[nivel] ?? ''}`}
                        aria-label={`Probabilidad ${String(probabilidad)}, impacto ${String(impacto)}: ${String(cantidad)} riesgos, nivel ${nombreDeNivel(nivel, bandas)}`}
                      >
                        <strong className="text-base tabular-nums">{cantidad}</strong>
                        <span>{nombreDeNivel(nivel, bandas)}</span>
                      </Link>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
