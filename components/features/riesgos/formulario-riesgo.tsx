'use client';

import { useActionState, useState } from 'react';

import type { EstadoRiesgos } from '@/app/(app)/[orgSlug]/riesgos/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';
import {
  ETIQUETA_IMPACTO,
  ETIQUETA_PROBABILIDAD,
  nivelDe,
  nombreDeNivel,
  puntuacion,
} from '@/lib/domain/riesgos/matriz';
import type { BandaMatriz, Escala } from '@/lib/domain/riesgos/matriz';

const INICIAL: EstadoRiesgos = {};

const RESPUESTAS = [
  { valor: 'MITIGAR', etiqueta: 'Mitigar' },
  { valor: 'EVITAR', etiqueta: 'Evitar' },
  { valor: 'TRANSFERIR', etiqueta: 'Transferir' },
  { valor: 'ACEPTAR', etiqueta: 'Aceptar' },
];

const ESCALA: Escala[] = [1, 2, 3, 4, 5];

export const CLASE_NIVEL: Record<string, string> = {
  BAJO: 'text-muted-foreground',
  MEDIO: 'text-status-amber',
  ALTO: 'text-destructive',
  MUY_ALTO: 'text-destructive font-semibold',
};

/**
 * Adding a risk.
 *
 * Cause, event and consequence are three fields rather than one, because a
 * register full of lines like "riesgo de penalidad" is a register nobody can
 * act on: you cannot mitigate a noun.
 *
 * The band updates as the two scales change, so the person scoring sees where
 * they are putting it before they save rather than after.
 */
export function FormularioRiesgo({
  accion,
  contratos,
  categorias,
  responsables,
  bandas,
}: {
  accion: (previo: EstadoRiesgos, formData: FormData) => Promise<EstadoRiesgos>;
  contratos: { id: string; etiqueta: string }[];
  categorias: { id: string; nombre: string }[];
  responsables: { id: string; nombre: string }[];
  bandas: readonly BandaMatriz[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [probabilidad, setProbabilidad] = useState<Escala>(3);
  const [impacto, setImpacto] = useState<Escala>(3);

  const nivel = nivelDe(probabilidad, impacto, bandas);

  return (
    <form action={enviar} className="space-y-4 rounded-lg border border-border p-4">
      <ErrorGeneral mensaje={estado.error} />

      {estado.exito ? (
        <p
          role="status"
          className="rounded-md border border-status-green/30 bg-status-green-subtle px-3 py-2 text-sm text-status-green"
        >
          {estado.exito}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="categoriaId" className="block text-sm font-medium">
            Categoría
          </label>
          <select
            id="categoriaId"
            name="categoriaId"
            defaultValue={categorias[0]?.id}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {categorias.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="contratoId" className="block text-sm font-medium">
            Contrato
          </label>
          <select
            id="contratoId"
            name="contratoId"
            defaultValue=""
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Toda la organización</option>
            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Causa, evento y consecuencia</legend>

        <div className="space-y-1.5">
          <label htmlFor="causa" className="block text-xs text-muted-foreground">
            Porque…
          </label>
          <input
            id="causa"
            name="causa"
            type="text"
            required
            placeholder="la plantilla adscrita está por debajo de lo exigido en el pliego"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="evento" className="block text-xs text-muted-foreground">
            puede ocurrir que…
          </label>
          <input
            id="evento"
            name="evento"
            type="text"
            required
            placeholder="el órgano detecte el incumplimiento en una inspección"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="consecuencia" className="block text-xs text-muted-foreground">
            con la consecuencia de que…
          </label>
          <input
            id="consecuencia"
            name="consecuencia"
            type="text"
            required
            placeholder="se imponga una penalidad y se descuente de la certificación"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="probabilidadInherente" className="block text-sm font-medium">
            Probabilidad
          </label>
          <select
            id="probabilidadInherente"
            name="probabilidadInherente"
            value={String(probabilidad)}
            onChange={(evento) => {
              setProbabilidad(Number(evento.target.value) as Escala);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ESCALA.map((valor) => (
              <option key={valor} value={valor}>
                {valor} — {ETIQUETA_PROBABILIDAD[valor]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="impactoInherente" className="block text-sm font-medium">
            Impacto
          </label>
          <select
            id="impactoInherente"
            name="impactoInherente"
            value={String(impacto)}
            onChange={(evento) => {
              setImpacto(Number(evento.target.value) as Escala);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {ESCALA.map((valor) => (
              <option key={valor} value={valor}>
                {valor} — {ETIQUETA_IMPACTO[valor]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium">Nivel inherente</span>
          <p
            role="status"
            className={`rounded-md border border-border px-3 py-2 text-sm ${CLASE_NIVEL[nivel] ?? ''}`}
          >
            {nombreDeNivel(nivel, bandas)} · {String(puntuacion(probabilidad, impacto))}
          </p>
        </div>
      </div>

      <details className="rounded-md border border-border px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">Responsable y revisión</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="respuesta" className="block text-sm font-medium">
              Respuesta
            </label>
            <select
              id="respuesta"
              name="respuesta"
              defaultValue="MITIGAR"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {RESPUESTAS.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="responsableId" className="block text-sm font-medium">
              Responsable
            </label>
            <select
              id="responsableId"
              name="responsableId"
              defaultValue=""
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {responsables.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="frecuenciaRevisionDias" className="block text-sm font-medium">
              Revisar cada
            </label>
            <select
              id="frecuenciaRevisionDias"
              name="frecuenciaRevisionDias"
              defaultValue="90"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="30">30 días</option>
              <option value="60">60 días</option>
              <option value="90">90 días</option>
              <option value="180">180 días</option>
              <option value="365">365 días</option>
            </select>
          </div>
        </div>
      </details>

      <BotonEnviar pendiente={pendiente}>Añadir al registro</BotonEnviar>
    </form>
  );
}
