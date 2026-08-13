'use client';

import { useActionState, useState } from 'react';

import type { EstadoRiesgos } from '@/app/(app)/[orgSlug]/riesgos/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';
import {
  ETIQUETA_IMPACTO,
  ETIQUETA_NIVEL,
  ETIQUETA_PROBABILIDAD,
  nivelDe,
  puntuacion,
} from '@/lib/domain/riesgos/matriz';
import type { Escala } from '@/lib/domain/riesgos/matriz';

const INICIAL: EstadoRiesgos = {};

const CATEGORIAS = [
  { valor: 'CONTRACTUAL', etiqueta: 'Contractual' },
  { valor: 'LABORAL', etiqueta: 'Laboral' },
  { valor: 'PREVENCION', etiqueta: 'Prevención' },
  { valor: 'ECONOMICO', etiqueta: 'Económico' },
  { valor: 'OPERATIVO', etiqueta: 'Operativo' },
  { valor: 'REPUTACIONAL', etiqueta: 'Reputacional' },
  { valor: 'CUMPLIMIENTO', etiqueta: 'Cumplimiento' },
  { valor: 'PROTECCION_DATOS', etiqueta: 'Protección de datos' },
];

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
}: {
  accion: (previo: EstadoRiesgos, formData: FormData) => Promise<EstadoRiesgos>;
  contratos: { id: string; etiqueta: string }[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [probabilidad, setProbabilidad] = useState<Escala>(3);
  const [impacto, setImpacto] = useState<Escala>(3);

  const nivel = nivelDe(probabilidad, impacto);

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
          <label htmlFor="categoria" className="block text-sm font-medium">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue="CONTRACTUAL"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {CATEGORIAS.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
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
            {ETIQUETA_NIVEL[nivel]} · {String(puntuacion(probabilidad, impacto))}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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
          <label htmlFor="controles" className="block text-sm font-medium">
            Controles
          </label>
          <input
            id="controles"
            name="controles"
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <BotonEnviar pendiente={pendiente}>Añadir al registro</BotonEnviar>
    </form>
  );
}
