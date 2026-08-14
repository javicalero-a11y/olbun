'use client';

import { useActionState } from 'react';

import { BotonEnviar, ErrorGeneral } from '@/components/features/auth/campo';

interface EstadoFormulario {
  error?: string;
  exito?: string;
  errores?: Record<string, string[]>;
}

export function FormularioControlRiesgo({
  accion,
  riesgoId,
  responsables,
}: {
  accion: (previo: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  riesgoId: string;
  responsables: { id: string; nombre: string }[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar} className="space-y-4 rounded-lg border border-border p-4">
      <input type="hidden" name="riesgoId" value={riesgoId} />
      <div>
        <h2 className="text-sm font-semibold">Añadir control</h2>
        <p className="text-xs text-muted-foreground">
          Un control se puede probar y evaluar; no es una frase perdida en la descripción.
        </p>
      </div>
      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? (
        <p role="status" className="text-sm text-status-green">
          {estado.exito}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="titulo-control" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="titulo-control"
            name="titulo"
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="tipo-control" className="text-sm font-medium">
              Tipo
            </label>
            <select
              id="tipo-control"
              name="tipo"
              defaultValue="PREVENTIVO"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="PREVENTIVO">Preventivo</option>
              <option value="DETECTIVO">Detectivo</option>
              <option value="CORRECTIVO">Correctivo</option>
              <option value="DIRECTIVO">Directivo</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="eficacia-control" className="text-sm font-medium">
              Eficacia
            </label>
            <select
              id="eficacia-control"
              name="eficacia"
              defaultValue="NO_EVALUADO"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="NO_EVALUADO">No evaluado</option>
              <option value="INEFICAZ">Ineficaz</option>
              <option value="PARCIAL">Parcial</option>
              <option value="EFICAZ">Eficaz</option>
            </select>
          </div>
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="descripcion-control" className="text-sm font-medium">
          Cómo funciona
        </label>
        <textarea
          id="descripcion-control"
          name="descripcion"
          rows={2}
          required
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <label htmlFor="responsable-control" className="text-sm font-medium">
            Responsable
          </label>
          <select
            id="responsable-control"
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
          <label htmlFor="ultimaPrueba" className="text-sm font-medium">
            Última prueba
          </label>
          <input
            id="ultimaPrueba"
            name="ultimaPrueba"
            type="date"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="proximaPrueba" className="text-sm font-medium">
            Próxima prueba
          </label>
          <input
            id="proximaPrueba"
            name="proximaPrueba"
            type="date"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="esExistente" defaultChecked /> Ya existe y opera hoy
      </label>
      <BotonEnviar pendiente={pendiente}>Guardar control</BotonEnviar>
    </form>
  );
}
