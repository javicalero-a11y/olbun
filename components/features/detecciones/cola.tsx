'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import type { EstadoDetecciones } from '@/app/(app)/[orgSlug]/detecciones/acciones';

/**
 * The triage queue (SPEC §5.4).
 *
 * The screen is built around one claim: a reviewer should be able to judge a
 * detection without opening the message. That is why the literal quote is
 * shown highlighted inside the surrounding sentences, and why the engine and
 * the confidence sit next to it — a reviewer who cannot see what the machine
 * was looking at is only rubber-stamping.
 *
 * Keyboard first, because the target is fifty of these in a quarter of an
 * hour. Shortcuts never fire while typing, and every one of them has a visible
 * button that does the same thing.
 */

export interface FilaDeteccion {
  id: string;
  tipo: string;
  etiqueta: string;
  descripcion: string;
  confianza: number;
  confianzaModelo: number;
  citasDescartadas: number;
  motor: string;
  esBajaConfianza: boolean;
  abreExpediente: boolean;
  /** Where confirming sends it when it is not an expediente. */
  destino: string;
  /** The submit label. Distinct per destination so the button says what
   * it will actually do, rather than a generic «Confirmar». */
  verboConfirmar: string;
  comunicacion: {
    id: string;
    asunto: string;
    de: string;
    fecha: string;
    contrato: string | null;
  };
  /** Verified quote with the text either side of it, from the source. */
  extractos: { antes: string; cita: string; despues: string }[];
  datos: { etiqueta: string; valor: string }[];
  /** Default dies a quo offered to the reviewer, who may change it. */
  fechaSugerida: string;
}

type AccionFormulario = (
  previo: EstadoDetecciones,
  formData: FormData,
) => Promise<EstadoDetecciones>;

const INICIAL: EstadoDetecciones = {};

function porcentaje(valor: number): string {
  return `${String(Math.round(valor * 100))} %`;
}

export function ColaDetecciones({
  filas,
  vacio,
  confirmar,
  descartar,
}: {
  filas: FilaDeteccion[];
  /**
   * Shown when there is nothing left. Rendered here rather than by the page,
   * because the page swapping to its own empty state would unmount this list
   * — and with it the message saying what the last decision just created.
   */
  vacio?: React.ReactNode;
  confirmar: AccionFormulario;
  descartar: AccionFormulario;
}) {
  const [activa, setActiva] = useState(0);
  const [aplazadas, setAplazadas] = useState<ReadonlySet<string>>(new Set());
  const [panel, setPanel] = useState<{ id: string; cual: 'confirmar' | 'descartar' } | null>(
    null,
  );
  /**
   * The outcome of the last decision, kept here rather than in the row.
   *
   * Acting on a detection takes it out of the queue, so the row unmounts the
   * moment it succeeds and any message inside it goes with it. Which is how a
   * reviewer ended up confirming a detection and never being told which
   * expediente it opened. This list stays mounted across the revalidation, so
   * the message survives where it is useful.
   */
  const [aviso, setAviso] = useState<string | null>(null);

  const visibles = filas.filter((fila) => !aplazadas.has(fila.id));
  const referencias = useRef(new Map<string, HTMLLIElement>());

  const mover = useCallback(
    (delta: number) => {
      setActiva((actual) => {
        const siguiente = Math.min(
          Math.max(actual + delta, 0),
          Math.max(visibles.length - 1, 0),
        );
        referencias.current.get(visibles[siguiente]?.id ?? '')?.focus();
        return siguiente;
      });
    },
    [visibles],
  );

  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      const destino = evento.target as HTMLElement | null;
      // Never steal a keystroke from someone writing a reason for discarding.
      if (
        destino?.tagName === 'INPUT' ||
        destino?.tagName === 'TEXTAREA' ||
        destino?.tagName === 'SELECT' ||
        destino?.isContentEditable
      ) {
        if (evento.key === 'Escape') setPanel(null);
        return;
      }

      const fila = visibles[activa];

      switch (evento.key) {
        case 'j':
          evento.preventDefault();
          mover(1);
          break;
        case 'k':
          evento.preventDefault();
          mover(-1);
          break;
        case 'c':
          if (!fila) break;
          evento.preventDefault();
          setPanel({ id: fila.id, cual: 'confirmar' });
          break;
        case 'd':
          if (!fila) break;
          evento.preventDefault();
          setPanel({ id: fila.id, cual: 'descartar' });
          break;
        case 'a':
          if (!fila) break;
          evento.preventDefault();
          setAplazadas((previas) => new Set(previas).add(fila.id));
          setPanel(null);
          break;
        case 'Escape':
          setPanel(null);
          break;
        default:
          break;
      }
    }

    document.addEventListener('keydown', alPulsar);
    return () => {
      document.removeEventListener('keydown', alPulsar);
    };
  }, [activa, mover, visibles]);

  const banner = aviso ? (
    <p
      role="status"
      className="rounded-md border border-status-green/30 bg-status-green-subtle px-3 py-2 text-sm text-status-green"
    >
      {aviso}
    </p>
  ) : null;

  if (visibles.length === 0) {
    return (
      <div className="space-y-3">
        {banner}
        {filas.length === 0 ? (
          (vacio ?? (
            <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
              No hay nada pendiente de revisar.
            </p>
          ))
        ) : (
          <p className="rounded-lg border border-border p-6 text-sm text-muted-foreground">
            Has aplazado todo lo pendiente. Vuelve a cargar la página para verlo de nuevo.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {banner}

      <p className="text-xs text-muted-foreground">
        Atajos: <kbd className="rounded border border-border px-1">j</kbd> y{' '}
        <kbd className="rounded border border-border px-1">k</kbd> para moverte,{' '}
        <kbd className="rounded border border-border px-1">c</kbd> confirmar,{' '}
        <kbd className="rounded border border-border px-1">d</kbd> descartar,{' '}
        <kbd className="rounded border border-border px-1">a</kbd> aplazar.
      </p>

      <ul className="space-y-3">
        {visibles.map((fila, indice) => (
          <li
            key={fila.id}
            tabIndex={-1}
            ref={(elemento) => {
              if (elemento) referencias.current.set(fila.id, elemento);
              else referencias.current.delete(fila.id);
            }}
            onFocus={() => {
              setActiva(indice);
            }}
            className={`rounded-lg border p-4 transition-colors outline-none ${
              indice === activa ? 'border-ring bg-card/60' : 'border-border'
            }`}
          >
            <Fila
              fila={fila}
              panel={panel?.id === fila.id ? panel.cual : null}
              abrirPanel={(cual) => {
                setPanel({ id: fila.id, cual });
              }}
              cerrarPanel={() => {
                setPanel(null);
              }}
              aplazar={() => {
                setAplazadas((previas) => new Set(previas).add(fila.id));
              }}
              avisar={setAviso}
              confirmar={confirmar}
              descartar={descartar}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Fila({
  fila,
  panel,
  abrirPanel,
  cerrarPanel,
  aplazar,
  avisar,
  confirmar,
  descartar,
}: {
  fila: FilaDeteccion;
  panel: 'confirmar' | 'descartar' | null;
  abrirPanel: (cual: 'confirmar' | 'descartar') => void;
  cerrarPanel: () => void;
  aplazar: () => void;
  avisar: (mensaje: string) => void;
  confirmar: AccionFormulario;
  descartar: AccionFormulario;
}) {
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<Record<string, string[]>>({});

  /**
   * Calls the action and reports the outcome upward, rather than holding it in
   * this row's own state.
   *
   * `useActionState` would be the obvious choice and does not work here: the
   * action revalidates, the refreshed queue no longer contains this detection,
   * and React unmounts the row in the same commit that delivers the result. A
   * success message stored here is destroyed before it ever renders. The
   * parent list survives the refresh, so the message goes there.
   */
  function enviar(accion: AccionFormulario) {
    return (formData: FormData) => {
      iniciar(async () => {
        const resultado = await accion(INICIAL, formData);

        if (resultado.exito) {
          avisar(resultado.exito);
          return;
        }

        setError(resultado.error ?? null);
        setErrores(resultado.errores ?? {});
      });
    };
  }

  const confirmando = enviando;
  const descartando = enviando;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{fila.etiqueta}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{fila.descripcion}</p>
        </div>
        <div className="text-right text-xs whitespace-nowrap text-muted-foreground">
          <span className={fila.esBajaConfianza ? 'text-status-amber' : 'text-foreground'}>
            Confianza {porcentaje(fila.confianza)}
          </span>
          {fila.citasDescartadas > 0 ? (
            <span title="Citas propuestas que no aparecían en el documento">
              {' '}
              · {String(fila.citasDescartadas)} cita
              {fila.citasDescartadas === 1 ? '' : 's'} descartada
              {fila.citasDescartadas === 1 ? '' : 's'}
            </span>
          ) : null}
          <p className="mt-0.5">{fila.motor}</p>
        </div>
      </div>

      {fila.extractos.map((extracto, indice) => (
        <blockquote
          key={indice}
          className="rounded-md border-l-2 border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed"
        >
          <span className="text-muted-foreground">{extracto.antes}</span>
          <mark className="bg-status-amber-subtle px-0.5 font-medium text-foreground">
            {extracto.cita}
          </mark>
          <span className="text-muted-foreground">{extracto.despues}</span>
        </blockquote>
      ))}

      {fila.datos.length > 0 ? (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          {fila.datos.map((dato) => (
            <div key={dato.etiqueta} className="flex gap-1">
              <dt className="text-muted-foreground">{dato.etiqueta}:</dt>
              <dd className="font-medium">{dato.valor}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {fila.comunicacion.asunto} · {fila.comunicacion.de} · {fila.comunicacion.fecha}
        {fila.comunicacion.contrato ? ` · ${fila.comunicacion.contrato}` : ' · sin contrato'}
      </p>

      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}

      {panel === null ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              abrirPanel('confirmar');
            }}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => {
              abrirPanel('descartar');
            }}
            className="rounded-md border border-input px-3 py-1.5 text-sm"
          >
            Descartar
          </button>
          <button
            type="button"
            onClick={aplazar}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
          >
            Aplazar
          </button>
        </div>
      ) : null}

      {panel === 'confirmar' ? (
        <form action={enviar(confirmar)} className="space-y-3 border-t border-border pt-3">
          <input type="hidden" name="deteccionId" value={fila.id} />

          {fila.abreExpediente ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label htmlFor={`fecha-${fila.id}`} className="block text-xs font-medium">
                    Fecha de inicio del cómputo
                  </label>
                  <input
                    id={`fecha-${fila.id}`}
                    name="fechaApertura"
                    type="date"
                    defaultValue={fila.fechaSugerida}
                    required
                    autoFocus
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    aria-describedby={`fecha-ayuda-${fila.id}`}
                  />
                  <p id={`fecha-ayuda-${fila.id}`} className="text-xs text-muted-foreground">
                    Todos los plazos del expediente se cuentan desde aquí. Se propone la fecha
                    del mensaje; cámbiala si el cómputo empieza otro día.
                  </p>
                </div>

                <div className="space-y-1">
                  <label htmlFor={`titulo-${fila.id}`} className="block text-xs font-medium">
                    Título del expediente
                  </label>
                  <input
                    id={`titulo-${fila.id}`}
                    name="titulo"
                    type="text"
                    placeholder={`${fila.etiqueta} — ${fila.comunicacion.asunto}`}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Not an expediente, but the record still needs a date and the
                  action's schema still wants one. */}
              <input type="hidden" name="fechaApertura" value={fila.fechaSugerida} />
              <p className="text-xs text-muted-foreground">{fila.destino}</p>
            </>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={confirmando}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {confirmando ? 'Confirmando…' : fila.verboConfirmar}
            </button>
            <button
              type="button"
              onClick={cerrarPanel}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {panel === 'descartar' ? (
        <form action={enviar(descartar)} className="space-y-3 border-t border-border pt-3">
          <input type="hidden" name="deteccionId" value={fila.id} />

          <div className="space-y-1">
            <label htmlFor={`motivo-${fila.id}`} className="block text-xs font-medium">
              ¿Por qué no procede?
            </label>
            <input
              id={`motivo-${fila.id}`}
              name="motivo"
              type="text"
              required
              autoFocus
              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              aria-describedby={`motivo-ayuda-${fila.id}`}
            />
            <p id={`motivo-ayuda-${fila.id}`} className="text-xs text-muted-foreground">
              Sirve para afinar la detección: lo que se descarta y por qué es lo que dice si el
              motor está señalando de más.
            </p>
            {errores['motivo']?.[0] ? (
              <p role="alert" className="text-xs text-destructive">
                {errores['motivo'][0]}
              </p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={descartando}
              className="rounded-md border border-input px-3 py-1.5 text-sm disabled:opacity-60"
            >
              {descartando ? 'Descartando…' : 'Descartar'}
            </button>
            <button
              type="button"
              onClick={cerrarPanel}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
