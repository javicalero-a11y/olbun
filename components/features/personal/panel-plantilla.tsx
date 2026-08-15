'use client';

import { useActionState } from 'react';

import type { EstadoPersonal } from '@/app/(app)/[orgSlug]/personal/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoPersonal = {};
const select = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
type Accion = (previo: EstadoPersonal, datos: FormData) => Promise<EstadoPersonal>;

export function PanelPlantilla({
  acciones,
  empleados,
  contratos,
  categorias,
  hoy,
}: {
  acciones: { adscripcion: Accion; exigencia: Accion };
  empleados: { id: string; nombre: string }[];
  contratos: { id: string; nombre: string }[];
  categorias: { id: string; nombre: string }[];
  hoy: string;
}) {
  const [estadoAdscripcion, adscribir, pendienteAdscripcion] = useActionState(
    acciones.adscripcion,
    INICIAL,
  );
  const [estadoExigencia, exigir, pendienteExigencia] = useActionState(
    acciones.exigencia,
    INICIAL,
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form
        action={adscribir}
        className="space-y-3 rounded-lg border border-border bg-card p-4"
      >
        <h2 className="text-sm font-semibold">Adscribir personal a un contrato</h2>
        <Resultado estado={estadoAdscripcion} />
        <Select
          id="adscripcion-empleadoId"
          nombre="empleadoId"
          etiqueta="Empleado"
          opciones={empleados}
        />
        <Select
          id="adscripcion-contratoId"
          nombre="contratoId"
          etiqueta="Contrato"
          opciones={contratos}
        />
        <Select
          id="adscripcion-categoriaId"
          nombre="categoriaId"
          etiqueta="Categoría en el servicio"
          opciones={categorias}
        />
        <Campo
          id="adscripcion-centroTrabajo"
          etiqueta="Centro de trabajo"
          nombre="centroTrabajo"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Horas semanales"
            nombre="horasSemanales"
            id="adscripcion-horasSemanales"
            inputMode="decimal"
            required
          />
          <Campo
            etiqueta="Dedicación (%)"
            nombre="porcentajeDedicacion"
            inputMode="decimal"
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Desde" nombre="fechaAlta" type="date" defaultValue={hoy} required />
          <Campo etiqueta="Hasta" nombre="fechaBaja" type="date" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="turno" className="text-sm font-medium">
            Turno
          </label>
          <select id="turno" name="turno" className={select}>
            <option value="MANANA">Mañana</option>
            <option value="TARDE">Tarde</option>
            <option value="NOCHE">Noche</option>
            <option value="PARTIDO">Partido</option>
            <option value="ROTATIVO">Rotativo</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="esPersonalClave" />
          Personal clave nombrado en la oferta
        </label>
        <BotonEnviar pendiente={pendienteAdscripcion}>Crear adscripción</BotonEnviar>
      </form>
      <form action={exigir} className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold">Registrar mínimo exigido por pliego</h2>
        <Resultado estado={estadoExigencia} />
        <Select
          id="exigencia-contratoId"
          nombre="contratoId"
          etiqueta="Contrato"
          opciones={contratos}
        />
        <Select
          id="exigencia-categoriaId"
          nombre="categoriaId"
          etiqueta="Categoría exigida"
          opciones={categorias}
        />
        <Campo
          id="exigencia-centroTrabajo"
          etiqueta="Centro de trabajo"
          nombre="centroTrabajo"
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Personas exigidas"
            nombre="numeroPersonas"
            type="number"
            min="1"
            required
          />
          <Campo
            etiqueta="Horas semanales exigidas"
            nombre="horasSemanales"
            id="exigencia-horasSemanales"
            inputMode="decimal"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="fuente" className="text-sm font-medium">
            Fuente
          </label>
          <select id="fuente" name="fuente" className={select}>
            <option value="PPT">PPT</option>
            <option value="PCAP">PCAP</option>
            <option value="OFERTA">Oferta</option>
            <option value="MODIFICADO">Modificado</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="clausula" className="text-sm font-medium">
            Cita literal de la cláusula
          </label>
          <textarea
            id="clausula"
            name="clausula"
            required
            className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>
        <Campo etiqueta="Penalidad asociada" nombre="penalidadDescripcion" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="esVinculante" defaultChecked />
          Obligación vinculante
        </label>
        <BotonEnviar pendiente={pendienteExigencia}>Registrar exigencia</BotonEnviar>
      </form>
    </div>
  );
}

function Select({
  id,
  nombre,
  etiqueta,
  opciones,
}: {
  id: string;
  nombre: string;
  etiqueta: string;
  opciones: { id: string; nombre: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <select id={id} name={nombre} className={select} required>
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
