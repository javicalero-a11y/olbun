'use client';

import { useActionState } from 'react';

import type { EstadoPersonal } from '@/app/(app)/[orgSlug]/personal/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoPersonal = {};
const select = 'w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
type Accion = (previo: EstadoPersonal, datos: FormData) => Promise<EstadoPersonal>;

function Estado({ estado }: { estado: EstadoPersonal }) {
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

export function PanelConvenios({
  acciones,
  convenios,
  categorias,
  contratos,
  hoy,
}: {
  acciones: { convenio: Accion; categoria: Accion; tabla: Accion; vinculo: Accion };
  convenios: { id: string; nombre: string }[];
  categorias: { id: string; convenioId: string; nombre: string }[];
  contratos: { id: string; etiqueta: string }[];
  hoy: string;
}) {
  const [estadoConvenio, crearConvenio, pendienteConvenio] = useActionState(
    acciones.convenio,
    INICIAL,
  );
  const [estadoCategoria, crearCategoria, pendienteCategoria] = useActionState(
    acciones.categoria,
    INICIAL,
  );
  const [estadoTabla, crearTabla, pendienteTabla] = useActionState(acciones.tabla, INICIAL);
  const [estadoVinculo, crearVinculo, pendienteVinculo] = useActionState(
    acciones.vinculo,
    INICIAL,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Formulario
        titulo="Registrar convenio"
        action={crearConvenio}
        estado={estadoConvenio}
        pendiente={pendienteConvenio}
        boton="Guardar convenio"
      >
        <Campo etiqueta="Nombre oficial" nombre="nombre" required />
        <Campo etiqueta="Sector" nombre="sector" required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Seleccion
            nombre="ambito"
            etiqueta="Ámbito"
            opciones={[
              ['ESTATAL', 'Estatal'],
              ['AUTONOMICO', 'Autonómico'],
              ['PROVINCIAL', 'Provincial'],
              ['EMPRESA', 'Empresa'],
              ['CENTRO', 'Centro'],
            ]}
          />
          <Campo etiqueta="Provincia" nombre="provincia" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Vigencia desde"
            nombre="vigenciaDesde"
            id="convenio-vigenciaDesde"
            type="date"
            defaultValue={hoy}
            required
          />
          <Campo etiqueta="Vigencia hasta" nombre="vigenciaHasta" type="date" />
        </div>
        <Campo etiqueta="Código / boletín" nombre="codigoBoletin" />
        <Campo etiqueta="URL oficial" nombre="urlBoletin" type="url" />
        <Campo etiqueta="Fecha de publicación" nombre="fechaPublicacion" type="date" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enUltraactividad" />
          En ultraactividad
        </label>
      </Formulario>

      <Formulario
        titulo="Añadir categoría profesional"
        action={crearCategoria}
        estado={estadoCategoria}
        pendiente={pendienteCategoria}
        boton="Guardar categoría"
      >
        <SelectEntidades
          id="categoria-convenioId"
          nombre="convenioId"
          etiqueta="Convenio"
          opciones={convenios}
        />
        <Campo etiqueta="Denominación" nombre="denominacion" required />
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo etiqueta="Grupo" nombre="grupo" required />
          <Campo etiqueta="Nivel" nombre="nivel" />
          <Campo
            etiqueta="Grupo SS"
            nombre="grupoCotizacionSS"
            type="number"
            min="1"
            max="11"
            required
          />
        </div>
      </Formulario>

      <Formulario
        titulo="Publicar tabla salarial"
        action={crearTabla}
        estado={estadoTabla}
        pendiente={pendienteTabla}
        boton="Guardar tabla"
      >
        <SelectEntidades
          id="tabla-convenioId"
          nombre="convenioId"
          etiqueta="Convenio"
          opciones={convenios}
        />
        <SelectEntidades
          id="tabla-categoriaId"
          nombre="categoriaId"
          etiqueta="Categoría"
          opciones={categorias.map((categoria) => ({
            id: categoria.id,
            nombre: categoria.nombre,
          }))}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Año"
            nombre="ano"
            type="number"
            defaultValue={new Date().getFullYear()}
            required
          />
          <Campo
            etiqueta="Vigencia desde"
            nombre="vigenciaDesde"
            id="tabla-vigenciaDesde"
            type="date"
            defaultValue={hoy}
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Salario base mensual (€)"
            nombre="salarioBaseMensual"
            inputMode="decimal"
            required
          />
          <Campo
            etiqueta="Número de pagas"
            nombre="numeroPagas"
            type="number"
            defaultValue="14"
            required
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            etiqueta="Jornada anual (h)"
            nombre="jornadaAnualHoras"
            inputMode="decimal"
            required
          />
          <Campo
            etiqueta="Precio hora extra (€)"
            nombre="precioHoraExtra"
            inputMode="decimal"
          />
        </div>
      </Formulario>

      <Formulario
        titulo="Vincular convenio a contrato"
        action={crearVinculo}
        estado={estadoVinculo}
        pendiente={pendienteVinculo}
        boton="Vincular"
      >
        <SelectEntidades
          id="vinculo-contratoId"
          nombre="contratoId"
          etiqueta="Contrato"
          opciones={contratos.map((contrato) => ({
            id: contrato.id,
            nombre: contrato.etiqueta,
          }))}
        />
        <SelectEntidades
          id="vinculo-convenioId"
          nombre="convenioId"
          etiqueta="Convenio"
          opciones={convenios}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="esPrincipal" defaultChecked />
          Convenio principal del contrato
        </label>
      </Formulario>
    </div>
  );
}

function Formulario({
  titulo,
  action,
  estado,
  pendiente,
  boton,
  children,
}: {
  titulo: string;
  action: (datos: FormData) => void;
  estado: EstadoPersonal;
  pendiente: boolean;
  boton: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action} className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <Estado estado={estado} />
      {children}
      <BotonEnviar pendiente={pendiente}>{boton}</BotonEnviar>
    </form>
  );
}

function Seleccion({
  nombre,
  etiqueta,
  opciones,
}: {
  nombre: string;
  etiqueta: string;
  opciones: [string, string][];
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={nombre} className="text-sm font-medium">
        {etiqueta}
      </label>
      <select id={nombre} name={nombre} className={select}>
        {opciones.map(([valor, texto]) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectEntidades({
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
