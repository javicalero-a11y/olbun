import type { ReactNode } from 'react';

/**
 * The shared table.
 *
 * Every list screen had grown its own copy of the same markup, and the copies
 * had already started to drift — some had a `<caption>`, some did not; some
 * marked the first cell as a row header, some left the row with no accessible
 * name at all. Those are exactly the details that decide whether a screen
 * reader can navigate a table, and exactly the details that get dropped when
 * the markup is retyped.
 *
 * A server component on purpose: these tables render from the database and
 * need no interactivity, so shipping them as client components would cost
 * JavaScript for nothing.
 */

export interface ColumnaTabla<T> {
  /** Stable key, also used for React's list identity. */
  clave: string;
  encabezado: ReactNode;
  /** Renders the cell for one row. */
  celda: (fila: T) => ReactNode;
  /** Right-aligned with tabular figures — money, counts, anything summed. */
  numerica?: boolean;
  /** Marks this column as the row's header, naming the row for a screen
   *  reader. Exactly one column should set it. */
  esCabeceraDeFila?: boolean;
  /** Utility classes for the cell, e.g. a width or a nowrap. */
  clase?: string;
}

export interface TablaProps<T> {
  /** Describes the table for assistive technology; visually hidden. */
  titulo: string;
  columnas: ColumnaTabla<T>[];
  filas: T[];
  claveDeFila: (fila: T) => string;
  /** Minimum width before the container scrolls horizontally. */
  anchoMinimo?: string;
  /** Shown instead of the table when there is nothing yet. */
  vacio?: ReactNode;
}

export function Tabla<T>({
  titulo,
  columnas,
  filas,
  claveDeFila,
  anchoMinimo = '720px',
  vacio,
}: TablaProps<T>) {
  if (filas.length === 0 && vacio) return <>{vacio}</>;

  return (
    // The scroll lives on the wrapper, so a wide table never makes the whole
    // page scroll sideways.
    <div className="overflow-x-auto">
      <table className="w-full text-left" style={{ minWidth: anchoMinimo }}>
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {columnas.map((columna) => (
              <th
                key={columna.clave}
                scope="col"
                className={`pb-2 font-medium ${columna.numerica ? 'text-right' : ''} ${
                  columna.clase ?? ''
                } ${columna === columnas.at(-1) ? '' : 'pr-4'}`}
              >
                {columna.encabezado}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => (
            <tr
              key={claveDeFila(fila)}
              className="border-b border-border align-top last:border-0"
            >
              {columnas.map((columna) => {
                const clases = `py-3 ${columna === columnas.at(-1) ? '' : 'pr-4'} ${
                  columna.numerica ? 'text-right' : ''
                } ${columna.clase ?? ''}`;

                return columna.esCabeceraDeFila ? (
                  <th key={columna.clave} scope="row" className={`${clases} font-normal`}>
                    {columna.celda(fila)}
                  </th>
                ) : (
                  <td
                    key={columna.clave}
                    className={clases}
                    {...(columna.numerica ? { 'data-numeric': true } : {})}
                  >
                    {columna.celda(fila)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The empty state pattern (AGENTS.md): say what the thing is, why it matters,
 * and offer the action — never just "no results".
 */
export function EstadoVacio({
  titulo,
  explicacion,
  accion,
}: {
  titulo: string;
  explicacion: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">{explicacion}</p>
      {accion ? <div className="mt-4">{accion}</div> : null}
    </div>
  );
}
