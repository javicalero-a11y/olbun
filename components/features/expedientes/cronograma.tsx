import type { BarraCronograma, Cronograma } from '@/lib/domain/expedientes/cronograma';
import { ETIQUETA_ESTADO_HITO } from '@/lib/domain/expedientes/etiquetas';
import { formatearEs } from '@/lib/domain/fecha';

/**
 * The expediente timeline.
 *
 * The chart is a picture of the table below it, not a replacement for it: both
 * are rendered from the same `Cronograma`, the table is always visible rather
 * than hidden behind a toggle, and the bars carry no information the table
 * lacks. That is what makes this reachable by keyboard and by screen reader
 * without a parallel implementation to keep in sync (WCAG 2.2 AA, SPEC §8).
 *
 * Nothing here is draggable. Dates move by editing a milestone in a form,
 * which works the same way with a mouse, a keyboard or a screen reader — and
 * leaves an audit trail, which dragging a bar does not.
 */

interface Aspecto {
  barra: string;
  punto: string;
  simbolo: string;
}

function aspectoDe(barra: BarraCronograma): Aspecto {
  if (barra.estado === 'CUMPLIDO') {
    return { barra: 'bg-status-green/70', punto: 'bg-status-green', simbolo: '✓' };
  }
  if (barra.estado === 'VENCIDO') {
    return { barra: 'bg-status-red/70', punto: 'bg-status-red', simbolo: '▲' };
  }
  if (barra.esPreclusivo) {
    return { barra: 'bg-status-red/55', punto: 'bg-status-red', simbolo: '▲' };
  }
  if (barra.esPlazo) {
    return { barra: 'bg-status-amber/60', punto: 'bg-status-amber', simbolo: '■' };
  }
  return { barra: 'bg-status-neutral/45', punto: 'bg-status-neutral', simbolo: '●' };
}

export function VistaCronograma({ cronograma }: { cronograma: Cronograma }) {
  const resumen = `Cronograma del expediente, del ${formatearEs(cronograma.desde)} al ${formatearEs(
    cronograma.hasta,
  )}, con ${String(cronograma.barras.length)} hitos. El detalle completo está en la tabla siguiente.`;

  return (
    <div className="space-y-6">
      <div
        className="overflow-x-auto rounded-lg border border-border bg-card p-4"
        role="img"
        aria-label={resumen}
      >
        <div className="min-w-[640px]">
          {/* Month axis */}
          <div className="relative mb-2 h-4 border-b border-border">
            {cronograma.meses.map((marca) => (
              <span
                key={marca.fecha}
                className="absolute top-0 -translate-x-1/2 text-[10px] text-muted-foreground"
                style={{ left: `${String(marca.posicionPct)}%` }}
              >
                {marca.etiqueta}
              </span>
            ))}
          </div>

          <div className="relative space-y-1.5">
            {/* Today's line, behind the bars. */}
            {cronograma.hoyPct !== undefined ? (
              <div
                className="pointer-events-none absolute inset-y-0 z-0 w-px bg-status-info"
                style={{ left: `${String(cronograma.hoyPct)}%` }}
              >
                <span className="absolute -top-0.5 left-1 text-[10px] font-medium whitespace-nowrap text-status-info">
                  hoy
                </span>
              </div>
            ) : null}

            {cronograma.barras.map((barra) => {
              const aspecto = aspectoDe(barra);

              return (
                <div key={barra.hitoId} className="relative z-10 flex items-center gap-3">
                  <span className="w-52 shrink-0 truncate text-xs text-muted-foreground">
                    {barra.nombre}
                  </span>
                  <span className="relative h-5 flex-1">
                    <span
                      className={`absolute top-1/2 flex h-4 -translate-y-1/2 items-center rounded-sm ${aspecto.barra} ${
                        barra.calculoCompleto ? '' : 'ring-1 ring-status-amber ring-offset-0'
                      }`}
                      style={{
                        left: `${String(barra.inicioPct)}%`,
                        width: `${String(barra.anchoPct)}%`,
                      }}
                    >
                      <span className="pl-1 text-[10px] leading-none text-background">
                        {aspecto.simbolo}
                      </span>
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <TablaCronograma cronograma={cronograma} />
    </div>
  );
}

/** The same data as the chart, in the form a screen reader can walk. */
export function TablaCronograma({ cronograma }: { cronograma: Cronograma }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left">
        <caption className="pb-2 text-left text-xs text-muted-foreground">
          Detalle del cronograma. Contiene la misma información que el gráfico anterior.
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="pr-4 pb-2 font-medium">
              Hito
            </th>
            <th scope="col" className="pr-4 pb-2 font-medium">
              Desde
            </th>
            <th scope="col" className="pr-4 pb-2 font-medium">
              Hasta
            </th>
            <th scope="col" className="pr-4 pb-2 font-medium">
              Estado
            </th>
            <th scope="col" className="pb-2 font-medium">
              Observaciones
            </th>
          </tr>
        </thead>
        <tbody>
          {cronograma.barras.map((barra) => {
            const aspecto = aspectoDe(barra);
            const observaciones: string[] = [];
            if (barra.esPreclusivo) observaciones.push('Plazo preclusivo');
            if (!barra.calculoCompleto) observaciones.push('Fecha sin verificar');

            return (
              <tr key={barra.hitoId} className="border-b border-border align-top last:border-0">
                <th scope="row" className="py-2.5 pr-4 text-sm font-medium">
                  <span aria-hidden="true" className="mr-1.5 text-xs">
                    {aspecto.simbolo}
                  </span>
                  {barra.nombre}
                </th>
                <td className="py-2.5 pr-4 text-xs" data-numeric>
                  {formatearEs(barra.desde)}
                </td>
                <td className="py-2.5 pr-4 text-xs" data-numeric>
                  {barra.desde === barra.hasta ? '—' : formatearEs(barra.hasta)}
                </td>
                <td className="py-2.5 pr-4 text-xs">
                  {ETIQUETA_ESTADO_HITO[barra.estado] ?? barra.estado}
                </td>
                <td className="py-2.5 text-xs text-muted-foreground">
                  {observaciones.length > 0 ? observaciones.join(' · ') : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
