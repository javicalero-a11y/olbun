'use client';

import { useActionState } from 'react';

import type { EstadoContratos } from '@/app/(app)/[orgSlug]/contratos/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoContratos = {};

interface Opcion {
  valor: string;
  etiqueta: string;
}

function Seleccion({
  nombre,
  etiqueta,
  opciones,
  defecto,
  errores,
  ayuda,
}: {
  nombre: string;
  etiqueta: string;
  opciones: Opcion[];
  defecto?: string;
  errores?: string[] | undefined;
  ayuda?: string;
}) {
  const errorId = `${nombre}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={nombre} className="block text-sm font-medium">
        {etiqueta}
      </label>
      <select
        id={nombre}
        name={nombre}
        defaultValue={defecto}
        aria-invalid={Boolean(errores?.length)}
        aria-describedby={errores?.length ? errorId : undefined}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      {ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
      {errores?.length ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {errores[0]}
        </p>
      ) : null}
    </div>
  );
}

export function FormularioContrato({
  accion,
  organos,
  tipos,
  procedimientos,
  estados,
}: {
  accion: (previo: EstadoContratos, formData: FormData) => Promise<EstadoContratos>;
  organos: Opcion[];
  tipos: Opcion[];
  procedimientos: Opcion[];
  estados: Opcion[];
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className="space-y-8" noValidate>
      <ErrorGeneral mensaje={estado.error} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Identificación</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Nº de expediente del órgano"
            nombre="numeroExpediente"
            required
            ayuda="El que usa el órgano en sus notificaciones."
            errores={estado.errores?.['numeroExpediente']}
          />
          <Campo etiqueta="Lote" nombre="lote" errores={estado.errores?.['lote']} />
        </div>

        <Campo
          etiqueta="Objeto del contrato"
          nombre="objeto"
          required
          errores={estado.errores?.['objeto']}
        />

        <Seleccion
          nombre="poderAdjudicadorId"
          etiqueta="Órgano de contratación"
          opciones={organos}
          errores={estado.errores?.['poderAdjudicadorId']}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Clasificación</h2>

        <div className="grid gap-4 sm:grid-cols-3">
          <Seleccion nombre="tipo" etiqueta="Tipo" opciones={tipos} defecto="SERVICIOS" />
          <Seleccion
            nombre="procedimiento"
            etiqueta="Procedimiento"
            opciones={procedimientos}
            defecto="ABIERTO"
          />
          <Seleccion
            nombre="estado"
            etiqueta="Estado"
            opciones={estados}
            defecto="EN_EJECUCION"
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Vigencia</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Fecha de formalización"
            nombre="fechaFormalizacion"
            type="date"
            errores={estado.errores?.['fechaFormalizacion']}
          />
          <Campo
            etiqueta="Inicio de ejecución"
            nombre="fechaInicio"
            type="date"
            errores={estado.errores?.['fechaInicio']}
          />
          <Campo
            etiqueta="Fin previsto"
            nombre="fechaFinPrevista"
            type="date"
            errores={estado.errores?.['fechaFinPrevista']}
          />
          <Campo
            etiqueta="Preaviso de prórroga (días)"
            nombre="preavisoProrrogaDias"
            inputMode="numeric"
            ayuda="Con cuántos días de antelación hay que comunicar la prórroga."
            errores={estado.errores?.['preavisoProrrogaDias']}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold">Económico</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            etiqueta="Importe de adjudicación"
            nombre="importeAdjudicacion"
            inputMode="decimal"
            ayuda="Sin IVA. Puedes escribirlo como 1.234.567,89."
            errores={estado.errores?.['importeAdjudicacion']}
          />
          <Campo
            etiqueta="Plazo de garantía (meses)"
            nombre="plazoGarantiaMeses"
            inputMode="numeric"
            errores={estado.errores?.['plazoGarantiaMeses']}
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="haySubrogacionPersonal" className="mt-0.5" />
            <span>
              Hay subrogación de personal
              <span className="block text-xs text-muted-foreground">
                El pliego o el convenio obligan a asumir la plantilla de la empresa saliente.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="hayRevisionPrecios" className="mt-0.5" />
            <span>Hay revisión de precios</span>
          </label>
        </div>
      </section>

      <div className="max-w-48">
        <BotonEnviar pendiente={pendiente}>Guardar contrato</BotonEnviar>
      </div>
    </form>
  );
}
