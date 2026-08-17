'use client';

import { useActionState } from 'react';

import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';
import { ETIQUETAS_ORIGEN, ORIGENES_JORNADA } from '@/lib/validation/jornada';
import type { EstadoJornada } from '@/app/(app)/[orgSlug]/personal/jornada/acciones';

const INICIAL: EstadoJornada = {};
const clases = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
type Accion = (previo: EstadoJornada, datos: FormData) => Promise<EstadoJornada>;

/**
 * Recording a day, and asking the register to prove itself.
 *
 * The two sit side by side on purpose. The record is only worth keeping if it
 * can be shown to be unaltered, and burying that check in an admin screen
 * would make it something nobody ever runs.
 */
export function PanelJornada({
  registrar,
  verificar,
  empleados,
  hoy,
  puedeRegistrar,
}: {
  registrar: Accion;
  verificar: Accion;
  empleados: { id: string; nombre: string }[];
  hoy: string;
  puedeRegistrar: boolean;
}) {
  const [estado, enviar, pendiente] = useActionState(registrar, INICIAL);
  const [comprobacion, comprobar, comprobando] = useActionState(verificar, INICIAL);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {puedeRegistrar ? (
        <form action={enviar} className="space-y-3 rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">Registrar una jornada</h2>
          <p className="text-xs text-muted-foreground">
            Se sella al guardar y no se puede editar después. Para arreglar un error se graba
            otro registro que lo corrige, y quedan los dos.
          </p>

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

          <div className="grid gap-3 sm:grid-cols-3">
            <Campo
              etiqueta="Fecha"
              nombre="fecha"
              type="date"
              defaultValue={hoy}
              required
              errores={estado.errores?.['fecha']}
            />
            <Campo
              etiqueta="Entrada"
              nombre="horaEntrada"
              placeholder="08:00"
              required
              errores={estado.errores?.['horaEntrada']}
            />
            <Campo
              etiqueta="Salida"
              nombre="horaSalida"
              placeholder="16:00"
              required
              errores={estado.errores?.['horaSalida']}
            />
          </div>

          <Campo
            etiqueta="Pausas"
            nombre="pausas"
            placeholder="12:00-12:30"
            ayuda="Separadas por comas. No cuentan como tiempo trabajado."
            errores={estado.errores?.['pausas']}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo
              etiqueta="Jornada pactada (h)"
              nombre="horasOrdinariasPactadas"
              defaultValue="8"
              ayuda="La del contrato o el convenio. Lo que pase de aquí es hora extra."
              required
              errores={estado.errores?.['horasOrdinariasPactadas']}
            />
            <div className="space-y-1.5">
              <label htmlFor="origen" className="text-sm font-medium">
                Origen
              </label>
              <select id="origen" name="origen" className={clases} defaultValue="MANUAL">
                {ORIGENES_JORNADA.map((origen) => (
                  <option key={origen} value={origen}>
                    {ETIQUETAS_ORIGEN[origen]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="esFestivo" />
            Domingo o festivo
          </label>

          <BotonEnviar pendiente={pendiente}>Registrar y sellar</BotonEnviar>
        </form>
      ) : null}

      <form
        action={comprobar}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Comprobar que el registro no se ha alterado</h2>
        <p className="text-xs text-muted-foreground">
          Recorre la cadena de esa persona desde el principio y comprueba cada sello. Es la
          respuesta a «demuestre que esto no se ha tocado».
        </p>

        <ErrorGeneral mensaje={comprobacion.error} />
        {comprobacion.exito ? (
          <p
            role="status"
            className="rounded-md bg-status-green-subtle px-3 py-2 text-sm text-status-green"
          >
            {comprobacion.exito}
          </p>
        ) : null}

        <div className="space-y-1.5">
          <label htmlFor="verificar-empleadoId" className="text-sm font-medium">
            Empleado a comprobar
          </label>
          <select id="verificar-empleadoId" name="empleadoId" className={clases} required>
            <option value="">Selecciona…</option>
            {empleados.map((empleado) => (
              <option key={empleado.id} value={empleado.id}>
                {empleado.nombre}
              </option>
            ))}
          </select>
        </div>

        <BotonEnviar pendiente={comprobando}>Comprobar la cadena</BotonEnviar>
      </form>
    </div>
  );
}
