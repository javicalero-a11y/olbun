'use client';

import { useActionState, useState } from 'react';

import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';
import { TIPOS_AUSENCIA, TIPOS_AUSENCIA_ORDENADOS } from '@/lib/domain/personal/ausencias';
import type { EstadoAusencias } from '@/app/(app)/[orgSlug]/personal/ausencias/acciones';

const INICIAL: EstadoAusencias = {};
const clases = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
type Accion = (previo: EstadoAusencias, datos: FormData) => Promise<EstadoAusencias>;

/**
 * Recording an absence.
 *
 * There is no diagnosis field and there never should be: it is Article 9
 * health data, it is not needed to cover a shift, and the safest place for
 * data you must not lose is a form that never collected it. The parte number
 * identifies the leave to the Seguridad Social without saying what it was for.
 */
export function PanelAusencias({
  registrar,
  empleados,
}: {
  registrar: Accion;
  empleados: { id: string; nombre: string }[];
}) {
  const [estado, enviar, pendiente] = useActionState(registrar, INICIAL);
  const [tipo, setTipo] = useState<string>('IT_CONTINGENCIA_COMUN');

  const definicion = TIPOS_AUSENCIA[tipo as keyof typeof TIPOS_AUSENCIA];
  const esIncapacidad = definicion?.familia === 'INCAPACIDAD_TEMPORAL';

  return (
    <form action={enviar} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Registrar una ausencia</h2>

      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? (
        <p
          role="status"
          className="rounded-md bg-status-green-subtle px-3 py-2 text-sm text-status-green"
        >
          {estado.exito}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <label htmlFor="empleadoId" className="text-sm font-medium">
          Empleado
        </label>
        <select id="empleadoId" name="empleadoId" className={clases} required>
          <option value="">Selecciona…</option>
          {empleados.map((empleado) => (
            <option key={empleado.id} value={empleado.id}>
              {empleado.nombre}
            </option>
          ))}
        </select>
        {estado.errores?.['empleadoId']?.[0] ? (
          <p className="text-sm text-destructive">{estado.errores['empleadoId'][0]}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="tipo" className="text-sm font-medium">
          Tipo
        </label>
        <select
          id="tipo"
          name="tipo"
          className={clases}
          value={tipo}
          onChange={(evento) => {
            setTipo(evento.target.value);
          }}
          required
        >
          {TIPOS_AUSENCIA_ORDENADOS.map((codigo) => (
            <option key={codigo} value={codigo}>
              {TIPOS_AUSENCIA[codigo].etiqueta}
            </option>
          ))}
        </select>
        {definicion ? (
          <p className="text-xs text-muted-foreground">
            {definicion.computaAbsentismo
              ? 'Computa en el índice de absentismo.'
              : 'No computa como absentismo, pero sí resta disponibilidad: el turno hay que cubrirlo igual.'}
          </p>
        ) : null}
      </div>

      <Campo
        etiqueta="Subtipo"
        nombre="subtipo"
        ayuda="Para permisos del art. 37 ET: matrimonio, fallecimiento, traslado…"
        errores={estado.errores?.['subtipo']}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Fecha de inicio"
          nombre="fechaInicio"
          type="date"
          required
          errores={estado.errores?.['fechaInicio']}
        />
        <Campo
          etiqueta="Fin previsto"
          nombre="fechaFinPrevista"
          type="date"
          ayuda="Se puede dejar en blanco: una baja abierta cuenta hasta hoy."
          errores={estado.errores?.['fechaFinPrevista']}
        />
      </div>

      {esIncapacidad ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Número de parte"
            nombre="numeroParteSS"
            ayuda="Identifica la baja ante la Seguridad Social. No se guarda el diagnóstico."
            errores={estado.errores?.['numeroParteSS']}
          />
          <Campo etiqueta="Mutua" nombre="mutua" errores={estado.errores?.['mutua']} />
        </div>
      ) : null}

      {esIncapacidad ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="esRecaida" />
          Es una recaída
        </label>
      ) : null}

      <BotonEnviar pendiente={pendiente}>Registrar ausencia</BotonEnviar>
    </form>
  );
}
