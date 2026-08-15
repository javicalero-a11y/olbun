'use client';

import { useActionState } from 'react';

import type { EstadoPersonal } from '@/app/(app)/[orgSlug]/personal/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoPersonal = {};
const select = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
type Accion = (previo: EstadoPersonal, datos: FormData) => Promise<EstadoPersonal>;

export function PanelCertificaciones({
  acciones,
  empleados,
  tipos,
}: {
  acciones: { tipo: Accion; certificacion: Accion };
  empleados: { id: string; nombre: string }[];
  tipos: { id: string; nombre: string }[];
}) {
  const [estadoTipo, crearTipo, pendienteTipo] = useActionState(acciones.tipo, INICIAL);
  const [estadoCertificado, crearCertificado, pendienteCertificado] = useActionState(
    acciones.certificacion,
    INICIAL,
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        action={crearTipo}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Nuevo tipo de certificación</h2>
        <Resultado estado={estadoTipo} />
        <Campo etiqueta="Código" nombre="codigo" required />
        <Campo etiqueta="Nombre" nombre="nombre" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Renovación (meses)"
            nombre="periodoRenovacionMeses"
            type="number"
            min="1"
          />
          <Campo
            etiqueta="Avisar con (días)"
            nombre="diasAviso"
            type="number"
            defaultValue="90"
            required
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="esObligatoria" />
          Obligatoria
        </label>
        <BotonEnviar pendiente={pendienteTipo}>Guardar tipo</BotonEnviar>
      </form>
      <form
        action={crearCertificado}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Registrar certificado de una persona</h2>
        <Resultado estado={estadoCertificado} />
        <Select nombre="empleadoId" etiqueta="Empleado" opciones={empleados} />
        <Select nombre="tipoId" etiqueta="Tipo" opciones={tipos} />
        <Campo
          etiqueta="Referencia"
          nombre="referencia"
          ayuda="Se cifra y no aparece en listados."
        />
        <Campo etiqueta="Emitido por" nombre="emitidaPor" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Fecha de emisión" nombre="fechaEmision" type="date" />
          <Campo etiqueta="Caducidad" nombre="fechaCaducidad" type="date" />
        </div>
        <BotonEnviar pendiente={pendienteCertificado}>Registrar certificado</BotonEnviar>
      </form>
    </div>
  );
}

function Select({
  nombre,
  etiqueta,
  opciones,
}: {
  nombre: string;
  etiqueta: string;
  opciones: { id: string; nombre: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={nombre} className="text-sm font-medium">
        {etiqueta}
      </label>
      <select id={nombre} name={nombre} className={select} required>
        <option value="">Selecciona…</option>
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {opcion.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
function Resultado({ estado }: { estado: EstadoPersonal }) {
  return (
    <>
      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? (
        <p
          role="status"
          className="rounded-md bg-status-green-subtle px-3 py-2 text-sm text-status-green"
        >
          {estado.exito}
        </p>
      ) : null}
    </>
  );
}
