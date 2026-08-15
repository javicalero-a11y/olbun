'use client';

import { useActionState, useState } from 'react';

import type { EstadoPersonal } from '@/app/(app)/[orgSlug]/personal/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoPersonal = {};
const claseSelect = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export function FormularioEmpleado({
  accion,
  convenios,
  categorias,
  contratos,
  hoy,
}: {
  accion: (previo: EstadoPersonal, datos: FormData) => Promise<EstadoPersonal>;
  convenios: { id: string; nombre: string }[];
  categorias: { id: string; convenioId: string; nombre: string }[];
  contratos: { id: string; etiqueta: string }[];
  hoy: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [convenioId, setConvenioId] = useState('');
  const categoriasDisponibles = categorias.filter(
    (categoria) => categoria.convenioId === convenioId,
  );

  return (
    <details className="rounded-lg border border-border bg-card" open={false}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
        Añadir empleado
      </summary>
      <form action={enviar} className="space-y-5 border-t border-border p-4">
        <ErrorGeneral mensaje={estado.error} />
        {estado.exito ? (
          <p
            role="status"
            className="rounded-md bg-status-green-subtle px-3 py-2 text-sm text-status-green"
          >
            {estado.exito}
          </p>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Identificación operativa</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo
              etiqueta="Número de empleado"
              nombre="numeroEmpleado"
              required
              errores={estado.errores?.['numeroEmpleado']}
            />
            <Campo
              etiqueta="Nombre"
              nombre="nombre"
              required
              errores={estado.errores?.['nombre']}
            />
            <Campo
              etiqueta="Apellidos"
              nombre="apellidos"
              required
              errores={estado.errores?.['apellidos']}
            />
            <Campo
              etiqueta="Correo"
              nombre="email"
              type="email"
              errores={estado.errores?.['email']}
            />
            <Campo
              etiqueta="Teléfono"
              nombre="telefono"
              errores={estado.errores?.['telefono']}
            />
            <Campo etiqueta="Puesto" nombre="puesto" errores={estado.errores?.['puesto']} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Relación laboral</legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              etiqueta="Fecha de alta"
              nombre="fechaAlta"
              type="date"
              defaultValue={hoy}
              required
              errores={estado.errores?.['fechaAlta']}
            />
            <Campo
              etiqueta="Antigüedad reconocida"
              nombre="antiguedadReconocida"
              type="date"
              defaultValue={hoy}
              required
              errores={estado.errores?.['antiguedadReconocida']}
            />
            <Campo
              etiqueta="Jornada (%)"
              nombre="jornadaPorcentaje"
              inputMode="decimal"
              defaultValue="100"
              required
              errores={estado.errores?.['jornadaPorcentaje']}
            />
            <Campo
              etiqueta="Horas semanales"
              nombre="horasSemanales"
              inputMode="decimal"
              defaultValue="40"
              required
              errores={estado.errores?.['horasSemanales']}
            />
            <div className="space-y-1.5">
              <label htmlFor="estado" className="text-sm font-medium">
                Estado
              </label>
              <select id="estado" name="estado" className={claseSelect} defaultValue="ACTIVO">
                <option value="ACTIVO">Activo</option>
                <option value="EXCEDENCIA">Excedencia</option>
                <option value="BAJA">Baja</option>
                <option value="FINALIZADO">Relación finalizada</option>
              </select>
            </div>
            <Campo
              etiqueta="Fecha de baja"
              nombre="fechaBaja"
              type="date"
              errores={estado.errores?.['fechaBaja']}
            />
            <Campo
              etiqueta="Código contrato SEPE"
              nombre="codigoContratoSEPE"
              placeholder="100"
              errores={estado.errores?.['codigoContratoSEPE']}
            />
            <Campo
              etiqueta="Grupo cotización SS"
              nombre="grupoCotizacion"
              type="number"
              min="1"
              max="11"
              errores={estado.errores?.['grupoCotizacion']}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">Convenio y categoría</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="convenioId" className="text-sm font-medium">
                Convenio aplicable
              </label>
              <select
                id="convenioId"
                name="convenioId"
                value={convenioId}
                onChange={(evento) => setConvenioId(evento.target.value)}
                className={claseSelect}
              >
                <option value="">Sin asignar todavía</option>
                {convenios.map((convenio) => (
                  <option key={convenio.id} value={convenio.id}>
                    {convenio.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="categoriaId" className="text-sm font-medium">
                Categoría profesional
              </label>
              <select
                id="categoriaId"
                name="categoriaId"
                className={claseSelect}
                defaultValue=""
              >
                <option value="">Sin asignar todavía</option>
                {categoriasDisponibles.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        <details className="rounded-md border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Datos protegidos y situaciones especiales
          </summary>
          <p className="mt-2 text-xs text-muted-foreground">
            Estos datos se cifran. Cada lectura posterior queda registrada en auditoría.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="NIF / NIE" nombre="nif" errores={estado.errores?.['nif']} />
            <Campo
              etiqueta="Número afiliación SS"
              nombre="numeroAfiliacionSS"
              errores={estado.errores?.['numeroAfiliacionSS']}
            />
            <Campo
              etiqueta="CCC"
              nombre="codigoCuentaCotizacion"
              errores={estado.errores?.['codigoCuentaCotizacion']}
            />
            <Campo
              etiqueta="Complemento ad personam (€ / mes)"
              nombre="complementoAdPersonam"
              inputMode="decimal"
              errores={estado.errores?.['complementoAdPersonam']}
            />
            <div className="space-y-1.5">
              <label htmlFor="motivoReduccion" className="text-sm font-medium">
                Motivo de reducción
              </label>
              <select
                id="motivoReduccion"
                name="motivoReduccion"
                className={claseSelect}
                defaultValue=""
              >
                <option value="">No aplica</option>
                <option value="GUARDA_LEGAL">Guarda legal</option>
                <option value="LACTANCIA">Lactancia</option>
                <option value="CUIDADO_FAMILIAR">Cuidado familiar</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Casilla nombre="tieneReduccionJornada" etiqueta="Tiene reducción de jornada" />
            <Casilla nombre="tieneDiscapacidadReconocida" etiqueta="Discapacidad reconocida" />
            <Casilla
              nombre="esRepresentanteTrabajadores"
              etiqueta="Representante de los trabajadores"
            />
            <Casilla nombre="esSubrogado" etiqueta="Personal subrogado" />
          </div>
          <div className="mt-4 space-y-1.5">
            <label htmlFor="contratoOrigenSubrogacionId" className="text-sm font-medium">
              Contrato de origen de la subrogación
            </label>
            <select
              id="contratoOrigenSubrogacionId"
              name="contratoOrigenSubrogacionId"
              className={claseSelect}
              defaultValue=""
            >
              <option value="">No indicado</option>
              {contratos.map((contrato) => (
                <option key={contrato.id} value={contrato.id}>
                  {contrato.etiqueta}
                </option>
              ))}
            </select>
          </div>
        </details>

        <div className="max-w-xs">
          <BotonEnviar pendiente={pendiente}>Guardar empleado</BotonEnviar>
        </div>
      </form>
    </details>
  );
}

function Casilla({ nombre, etiqueta }: { nombre: string; etiqueta: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={nombre} className="h-4 w-4 rounded border-input" />
      {etiqueta}
    </label>
  );
}
