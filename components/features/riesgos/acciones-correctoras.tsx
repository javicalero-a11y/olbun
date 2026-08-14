'use client';

import { useActionState } from 'react';

import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

interface EstadoFormulario {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

export interface AccionCorrectoraVista {
  id: string;
  titulo: string;
  descripcion: string;
  estado: 'PENDIENTE' | 'EN_CURSO' | 'BLOQUEADA' | 'COMPLETADA' | 'VERIFICADA' | 'CANCELADA';
  prioridad: 'BAJA' | 'MEDIA' | 'ALTA' | 'URGENTE';
  progreso: number;
  fechaLimite: string | null;
  responsable: string | null;
  motivoBloqueo: string | null;
  eficacia: string | null;
}

const ETIQUETA_ESTADO: Record<AccionCorrectoraVista['estado'], string> = {
  PENDIENTE: 'Pendiente',
  EN_CURSO: 'En curso',
  BLOQUEADA: 'Bloqueada',
  COMPLETADA: 'Completada, pendiente de verificar',
  VERIFICADA: 'Verificada',
  CANCELADA: 'Cancelada',
};

export function AccionesCorrectoras({
  acciones,
  origen,
  responsables,
  accionCrear,
  accionActualizar,
  editable,
}: {
  acciones: AccionCorrectoraVista[];
  origen: { tipo: 'riesgo' | 'incidencia'; id: string };
  responsables: { id: string; nombre: string }[];
  accionCrear: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  accionActualizar: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  editable: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(accionCrear, {});
  return (
    <section className="space-y-4" aria-labelledby="acciones-titulo">
      <div>
        <h2 id="acciones-titulo" className="text-base font-semibold">
          Acciones correctoras
        </h2>
        <p className="text-xs text-muted-foreground">
          Completar no es verificar: una segunda fase documenta si la medida funcionó.
        </p>
      </div>

      {acciones.length ? (
        <ul className="space-y-3">
          {acciones.map((accion) => (
            <li key={accion.id}>
              <FilaAccion accion={accion} actualizar={accionActualizar} editable={editable} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          Todavía no hay acciones. Añade la primera medida con responsable y fecha.
        </p>
      )}

      {editable ? (
        <form action={enviar} className="space-y-3 rounded-lg border border-border p-4">
          <input
            type="hidden"
            name={origen.tipo === 'riesgo' ? 'riesgoId' : 'incidenciaId'}
            value={origen.id}
          />
          <h3 className="text-sm font-semibold">Nueva acción</h3>
          <ErrorGeneral mensaje={estado.error} />
          {estado.exito ? (
            <p role="status" className="text-sm text-status-green">
              {estado.exito}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`titulo-${origen.tipo}`} className="text-sm font-medium">
                Título
              </label>
              <input
                id={`titulo-${origen.tipo}`}
                name="titulo"
                required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor={`prioridad-${origen.tipo}`} className="text-sm font-medium">
                  Prioridad
                </label>
                <select
                  id={`prioridad-${origen.tipo}`}
                  name="prioridad"
                  defaultValue="MEDIA"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="BAJA">Baja</option>
                  <option value="MEDIA">Media</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`limite-${origen.tipo}`} className="text-sm font-medium">
                  Fecha límite
                </label>
                <input
                  id={`limite-${origen.tipo}`}
                  name="fechaLimite"
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor={`descripcion-${origen.tipo}`} className="text-sm font-medium">
              Resultado esperado
            </label>
            <textarea
              id={`descripcion-${origen.tipo}`}
              name="descripcion"
              rows={2}
              required
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="max-w-sm space-y-1.5">
            <label htmlFor={`responsable-${origen.tipo}`} className="text-sm font-medium">
              Responsable
            </label>
            <select
              id={`responsable-${origen.tipo}`}
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
          <BotonEnviar pendiente={pendiente}>Crear acción</BotonEnviar>
        </form>
      ) : null}
    </section>
  );
}

function FilaAccion({
  accion,
  actualizar,
  editable,
}: {
  accion: AccionCorrectoraVista;
  actualizar: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  editable: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(actualizar, {});
  return (
    <form action={enviar} className="space-y-3 rounded-lg border border-border p-4">
      <input type="hidden" name="accionId" value={accion.id} />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{accion.titulo}</h3>
          <p className="text-xs text-muted-foreground">{accion.descripcion}</p>
        </div>
        <span className="rounded-full border border-border px-2 py-1 text-xs">
          {ETIQUETA_ESTADO[accion.estado]} · {accion.progreso}%
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {accion.responsable ?? 'Sin responsable'} ·{' '}
        {accion.fechaLimite ? `vence ${accion.fechaLimite}` : 'sin fecha límite'} · prioridad{' '}
        {accion.prioridad.toLowerCase()}
      </p>
      {accion.motivoBloqueo ? (
        <p className="text-xs text-status-amber">Bloqueo: {accion.motivoBloqueo}</p>
      ) : null}
      {accion.eficacia ? (
        <p className="text-xs text-status-green">Verificación: {accion.eficacia}</p>
      ) : null}
      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? (
        <p role="status" className="text-sm text-status-green">
          {estado.exito}
        </p>
      ) : null}
      {editable ? (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-primary">
            Actualizar avance
          </summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`estado-${accion.id}`} className="text-xs font-medium">
                Estado
              </label>
              <select
                id={`estado-${accion.id}`}
                name="estado"
                defaultValue={accion.estado}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(ETIQUETA_ESTADO).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`progreso-${accion.id}`} className="text-xs font-medium">
                Progreso (%)
              </label>
              <input
                id={`progreso-${accion.id}`}
                name="progreso"
                type="number"
                min="0"
                max="100"
                defaultValue={accion.progreso}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`bloqueo-${accion.id}`} className="text-xs font-medium">
                Motivo del bloqueo
              </label>
              <input
                id={`bloqueo-${accion.id}`}
                name="motivoBloqueo"
                defaultValue={accion.motivoBloqueo ?? ''}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor={`eficacia-${accion.id}`} className="text-xs font-medium">
                Eficacia al verificar
              </label>
              <input
                id={`eficacia-${accion.id}`}
                name="eficacia"
                defaultValue={accion.eficacia ?? ''}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <BotonEnviar pendiente={pendiente}>Guardar avance</BotonEnviar>
          </div>
        </details>
      ) : null}
    </form>
  );
}
