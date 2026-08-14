'use client';

import { useActionState } from 'react';

import type { EstadoBuzon } from '@/app/(app)/[orgSlug]/comunicaciones/buzones-acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoBuzon = {};

function FilaLote({
  lote,
  recoger,
}: {
  lote: {
    id: string;
    buzon: string;
    estado: string;
    total: number;
    completados: number;
    fallidos: number;
    fecha: string;
  };
  recoger: (previo: EstadoBuzon, formData: FormData) => Promise<EstadoBuzon>;
}) {
  const [estado, ejecutar, pendiente] = useActionState(recoger, INICIAL);
  return (
    <li className="space-y-2 rounded-md bg-secondary/30 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong>{lote.buzon}</strong> · {lote.estado} · {String(lote.completados)}/
          {String(lote.total)} · {String(lote.fallidos)} fallidos · {lote.fecha}
        </span>
        {lote.estado === 'EN_PROCESO' ? (
          <form action={ejecutar}>
            <input type="hidden" name="loteId" value={lote.id} />
            <BotonEnviar pendiente={pendiente}>Comprobar resultado</BotonEnviar>
          </form>
        ) : null}
      </div>
      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? (
        <p role="status" className="text-status-green">
          {estado.exito}
        </p>
      ) : null}
    </li>
  );
}

export function PanelLotes({
  crear,
  recoger,
  pendientes,
  lotes,
  disponible,
}: {
  crear: (previo: EstadoBuzon, formData: FormData) => Promise<EstadoBuzon>;
  recoger: (previo: EstadoBuzon, formData: FormData) => Promise<EstadoBuzon>;
  pendientes: { id: string; direccion: string; cantidad: number }[];
  lotes: {
    id: string;
    buzon: string;
    estado: string;
    total: number;
    completados: number;
    fallidos: number;
    fecha: string;
  }[];
  disponible: boolean;
}) {
  const [estado, ejecutar, pendiente] = useActionState(crear, INICIAL);
  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div>
        <h2 className="text-sm font-semibold">Análisis histórico por lotes</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Envía hasta 500 mensajes iniciales a Claude Message Batches. Es asíncrono, reduce el
          coste y cada resultado conserva las mismas citas verificadas que el análisis
          individual.
        </p>
      </div>

      {lotes.length > 0 ? (
        <ul className="space-y-2">
          {lotes.map((lote) => (
            <FilaLote key={lote.id} lote={lote} recoger={recoger} />
          ))}
        </ul>
      ) : null}

      {disponible && pendientes.length > 0 ? (
        <form action={ejecutar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="lote-buzon" className="text-sm font-medium">
              Histórico pendiente
            </label>
            <select
              id="lote-buzon"
              name="buzonId"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {pendientes.map((buzon) => (
                <option key={buzon.id} value={buzon.id}>
                  {buzon.direccion} — {String(buzon.cantidad)} mensajes
                </option>
              ))}
            </select>
          </div>
          <BotonEnviar pendiente={pendiente}>Enviar lote</BotonEnviar>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">
          {disponible
            ? 'No hay mensajes históricos pendientes de lote.'
            : 'Sin ANTHROPIC_API_KEY, Olbun usa el motor local y no envía correspondencia a terceros.'}
        </p>
      )}

      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? (
        <p role="status" className="text-xs text-status-green">
          {estado.exito}
        </p>
      ) : null}
    </section>
  );
}
