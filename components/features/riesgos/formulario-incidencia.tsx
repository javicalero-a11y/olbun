'use client';

import { useActionState, useState } from 'react';

import type { EstadoIncidencias } from '@/app/(app)/[orgSlug]/incidencias/acciones';
import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoIncidencias = {};

const TIPOS = [
  { valor: 'FALLO_SERVICIO', etiqueta: 'Fallo del servicio' },
  { valor: 'QUEJA_USUARIO', etiqueta: 'Queja de usuario' },
  { valor: 'ACCIDENTE', etiqueta: 'Accidente con baja' },
  { valor: 'INCIDENTE_SIN_BAJA', etiqueta: 'Incidente sin baja' },
  { valor: 'DANO_MATERIAL', etiqueta: 'Daño material' },
  { valor: 'AGRESION', etiqueta: 'Agresión' },
  { valor: 'MEDIOAMBIENTAL', etiqueta: 'Medioambiental' },
  { valor: 'VEHICULO', etiqueta: 'Vehículo' },
  { valor: 'SEGURIDAD_DATOS', etiqueta: 'Seguridad de datos' },
];

const GRAVEDADES = [
  { valor: 'LEVE', etiqueta: 'Leve' },
  { valor: 'MODERADA', etiqueta: 'Moderada' },
  { valor: 'GRAVE', etiqueta: 'Grave' },
  { valor: 'MUY_GRAVE', etiqueta: 'Muy grave' },
];

/**
 * Reporting what happened.
 *
 * Accidents and data breaches can activate external reporting duties. The
 * interface raises the question without inferring a deadline or legal duty;
 * PRL or the DPD must confirm the concrete case.
 */
export function FormularioIncidencia({
  accion,
  contratos,
}: {
  accion: (previo: EstadoIncidencias, formData: FormData) => Promise<EstadoIncidencias>;
  contratos: { id: string; etiqueta: string }[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [tipo, setTipo] = useState('FALLO_SERVICIO');

  const puedeSerNotificable = tipo === 'ACCIDENTE' || tipo === 'SEGURIDAD_DATOS';

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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="tipo" className="block text-sm font-medium">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            value={tipo}
            onChange={(evento) => {
              setTipo(evento.target.value);
            }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {TIPOS.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="gravedad" className="block text-sm font-medium">
            Gravedad
          </label>
          <select
            id="gravedad"
            name="gravedad"
            defaultValue="MODERADA"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {GRAVEDADES.map((opcion) => (
              <option key={opcion.valor} value={opcion.valor}>
                {opcion.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="fechaHecho" className="block text-sm font-medium">
            Fecha del hecho
          </label>
          <input
            id="fechaHecho"
            name="fechaHecho"
            type="date"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="descripcion" className="block text-sm font-medium">
          Qué pasó
        </label>
        <textarea
          id="descripcion"
          name="descripcion"
          rows={3}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          aria-describedby="descripcion-ayuda"
        />
        <p id="descripcion-ayuda" className="text-xs text-muted-foreground">
          Quien lo lea dentro de un año no estaba allí.
        </p>
        {estado.errores?.['descripcion']?.[0] ? (
          <p className="text-xs text-destructive">{estado.errores['descripcion'][0]}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="lugar" className="block text-sm font-medium">
            Lugar
          </label>
          <input
            id="lugar"
            name="lugar"
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
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
            <option value="">Sin vincular</option>
            {contratos.map((contrato) => (
              <option key={contrato.id} value={contrato.id}>
                {contrato.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="medidasInmediatas" className="block text-sm font-medium">
          Medidas inmediatas
        </label>
        <textarea
          id="medidasInmediatas"
          name="medidasInmediatas"
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-start gap-2">
        <input
          id="esNotificableAAutoridad"
          name="esNotificableAAutoridad"
          type="checkbox"
          className="mt-1"
          aria-describedby="notificable-ayuda"
        />
        <div>
          <label htmlFor="esNotificableAAutoridad" className="text-sm font-medium">
            Hay que comunicarlo a una autoridad
          </label>
          <p id="notificable-ayuda" className="text-xs text-muted-foreground">
            {puedeSerNotificable
              ? 'Puede activar plazos diferentes ante Delt@ o la AEPD. Registra cuándo se conoció y valida el deber concreto con PRL o el DPD; Olbun no lo presume.'
              : 'Márcalo si algún organismo tiene que enterarse. Nadie lo deduce por ti.'}
          </p>
        </div>
      </div>

      <BotonEnviar pendiente={pendiente}>Registrar incidencia</BotonEnviar>
    </form>
  );
}
