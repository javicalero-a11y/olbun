'use client';

import { useActionState, useState } from 'react';

import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

interface EstadoFormulario {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

export function FormularioInvestigacion({
  accion,
  incidencia,
}: {
  accion: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  incidencia: {
    id: string;
    estado: 'ABIERTA' | 'EN_INVESTIGACION' | 'CERRADA' | 'REABIERTA';
    causaRaiz: string | null;
    leccionesAprendidas: string | null;
    comunicadaAlOrgano: boolean;
    esNotificableAAutoridad: boolean;
    notificadaAAutoridad: boolean;
    referenciaAutoridad: string | null;
  };
}) {
  const [estadoFormulario, enviar, pendiente] = useActionState(accion, {});
  const [estado, setEstado] = useState(incidencia.estado);
  return (
    <form action={enviar} className="space-y-4 rounded-lg border border-border p-4">
      <input type="hidden" name="incidenciaId" value={incidencia.id} />
      <div>
        <h2 className="text-sm font-semibold">Investigación y cierre</h2>
        <p className="text-xs text-muted-foreground">
          Cerrar exige causa raíz; en hechos graves también exige lecciones aprendidas.
        </p>
      </div>
      <ErrorGeneral mensaje={estadoFormulario.error} />
      {estadoFormulario.exito ? (
        <p role="status" className="text-sm text-status-green">
          {estadoFormulario.exito}
        </p>
      ) : null}
      <div className="max-w-sm space-y-1.5">
        <label htmlFor="estado-incidencia" className="text-sm font-medium">
          Estado
        </label>
        <select
          id="estado-incidencia"
          name="estado"
          value={estado}
          onChange={(evento) => setEstado(evento.target.value as typeof estado)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="ABIERTA">Abierta</option>
          <option value="EN_INVESTIGACION">En investigación</option>
          <option value="CERRADA">Cerrada</option>
          <option value="REABIERTA">Reabierta</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="causaRaiz" className="text-sm font-medium">
            Causa raíz
          </label>
          <textarea
            id="causaRaiz"
            name="causaRaiz"
            rows={3}
            defaultValue={incidencia.causaRaiz ?? ''}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          {estadoFormulario.errores?.['causaRaiz']?.[0] ? (
            <p className="text-xs text-destructive">
              {estadoFormulario.errores['causaRaiz'][0]}
            </p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="leccionesAprendidas" className="text-sm font-medium">
            Lecciones aprendidas
          </label>
          <textarea
            id="leccionesAprendidas"
            name="leccionesAprendidas"
            rows={3}
            defaultValue={incidencia.leccionesAprendidas ?? ''}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <fieldset className="space-y-3 rounded-md bg-muted/40 p-3">
        <legend className="px-1 text-sm font-medium">Comunicaciones externas</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="comunicadaAlOrgano"
            defaultChecked={incidencia.comunicadaAlOrgano}
          />{' '}
          Comunicada al órgano de contratación
        </label>
        {incidencia.esNotificableAAutoridad ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="notificadaAAutoridad"
                defaultChecked={incidencia.notificadaAAutoridad}
              />{' '}
              Notificada a la autoridad competente
            </label>
            <div className="max-w-md space-y-1.5">
              <label htmlFor="referenciaAutoridad" className="text-xs font-medium">
                Referencia de Delt@, AEPD u organismo
              </label>
              <input
                id="referenciaAutoridad"
                name="referenciaAutoridad"
                defaultValue={incidencia.referenciaAutoridad ?? ''}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : null}
      </fieldset>
      <BotonEnviar pendiente={pendiente}>
        {estado === 'CERRADA' ? 'Cerrar incidencia' : 'Guardar investigación'}
      </BotonEnviar>
    </form>
  );
}
