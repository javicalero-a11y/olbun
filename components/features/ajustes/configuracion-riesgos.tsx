'use client';

import { useActionState } from 'react';

import type { EstadoConfiguracionRiesgos } from '@/app/(app)/[orgSlug]/ajustes/riesgos/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoConfiguracionRiesgos = {};

type AccionFormulario = (
  previo: EstadoConfiguracionRiesgos,
  formData: FormData,
) => Promise<EstadoConfiguracionRiesgos>;

interface Categoria {
  id: string;
  clave: string;
  nombre: string;
  color: string;
  isActive: boolean;
}

interface Banda {
  nivel: 'BAJO' | 'MEDIO' | 'ALTO' | 'MUY_ALTO';
  nombre: string;
  puntuacionMinima: number;
  puntuacionMaxima: number;
  color: string;
}

export function ConfiguracionRiesgos({
  categorias,
  bandas,
  crearCategoria,
  actualizarCategoria,
  actualizarBandas,
}: {
  categorias: Categoria[];
  bandas: Banda[];
  crearCategoria: AccionFormulario;
  actualizarCategoria: AccionFormulario;
  actualizarBandas: AccionFormulario;
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-4" aria-labelledby="matriz-riesgo">
        <div>
          <h2 id="matriz-riesgo" className="text-base font-semibold">
            Matriz 5 × 5
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Define qué puntuaciones pertenecen a cada nivel. El cambio se aplica a las vistas
            actuales; las valoraciones históricas conservan la matriz con la que se firmaron.
          </p>
        </div>
        <FormularioBandas bandas={bandas} accion={actualizarBandas} />
      </section>

      <section className="space-y-4" aria-labelledby="categorias-riesgo">
        <div>
          <h2 id="categorias-riesgo" className="text-base font-semibold">
            Categorías
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Adapta el registro a vuestra operación. Desactivar una categoría impide usarla en
            riesgos nuevos, sin ocultar los ya clasificados.
          </p>
        </div>

        <div className="space-y-3">
          {categorias.map((categoria) => (
            <FilaCategoria
              key={categoria.id}
              categoria={categoria}
              accion={actualizarCategoria}
            />
          ))}
        </div>

        <FormularioNuevaCategoria accion={crearCategoria} />
      </section>
    </div>
  );
}

function FormularioBandas({ bandas, accion }: { bandas: Banda[]; accion: AccionFormulario }) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const porNivel = new Map(bandas.map((banda) => [banda.nivel, banda]));
  const bajo = porNivel.get('BAJO');
  const medio = porNivel.get('MEDIO');
  const alto = porNivel.get('ALTO');
  const muyAlto = porNivel.get('MUY_ALTO');

  if (!bajo || !medio || !alto || !muyAlto) {
    return <ErrorGeneral mensaje="La matriz está incompleta. Contacta con soporte." />;
  }

  const filas = [
    { prefijo: 'bajo', banda: bajo, finalEditable: true },
    { prefijo: 'medio', banda: medio, finalEditable: true },
    { prefijo: 'alto', banda: alto, finalEditable: true },
    { prefijo: 'muyAlto', banda: muyAlto, finalEditable: false },
  ] as const;

  return (
    <form action={enviar} className="space-y-4 rounded-lg border border-border p-4">
      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? <MensajeExito>{estado.exito}</MensajeExito> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[580px] text-left text-sm">
          <caption className="sr-only">Umbrales y colores de la matriz de riesgo</caption>
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="pb-2 font-medium" scope="col">
                Nivel
              </th>
              <th className="pb-2 font-medium" scope="col">
                Color
              </th>
              <th className="pb-2 font-medium" scope="col">
                Desde
              </th>
              <th className="pb-2 font-medium" scope="col">
                Hasta
              </th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ prefijo, banda, finalEditable }) => (
              <tr key={banda.nivel} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3">
                  <input
                    aria-label={`Nombre del nivel ${banda.nivel}`}
                    name={`${prefijo}Nombre`}
                    defaultValue={banda.nombre}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5"
                  />
                </td>
                <td className="py-2 pr-3">
                  <input
                    aria-label={`Color del nivel ${banda.nombre}`}
                    name={`${prefijo}Color`}
                    type="color"
                    defaultValue={banda.color}
                    className="h-9 w-14 cursor-pointer rounded border border-input bg-background p-1"
                  />
                </td>
                <td className="py-2 pr-3 tabular-nums">{banda.puntuacionMinima}</td>
                <td className="py-2 tabular-nums">
                  {finalEditable ? (
                    <input
                      aria-label={`Puntuación máxima del nivel ${banda.nombre}`}
                      name={`${prefijo}Hasta`}
                      type="number"
                      min={1}
                      max={24}
                      defaultValue={banda.puntuacionMaxima}
                      className="w-20 rounded-md border border-input bg-background px-2 py-1.5"
                    />
                  ) : (
                    25
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {estado.errores?.['altoHasta'] ? (
        <p role="alert" className="text-xs text-destructive">
          {estado.errores['altoHasta'][0]}
        </p>
      ) : null}
      <div className="max-w-44">
        <BotonEnviar pendiente={pendiente}>Guardar matriz</BotonEnviar>
      </div>
    </form>
  );
}

function FilaCategoria({
  categoria,
  accion,
}: {
  categoria: Categoria;
  accion: AccionFormulario;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form action={enviar} className="rounded-lg border border-border p-4">
      <input type="hidden" name="categoriaId" value={categoria.id} />
      <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
        <Campo
          etiqueta={categoria.clave.replaceAll('_', ' ')}
          nombre="nombre"
          id={`categoria-${categoria.id}-nombre`}
          defaultValue={categoria.nombre}
          errores={estado.errores?.['nombre']}
          required
        />
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">Color</span>
          <input
            aria-label={`Color de ${categoria.nombre}`}
            name="color"
            type="color"
            defaultValue={categoria.color}
            className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
          />
        </label>
        <label className="flex h-10 items-center gap-2 text-sm">
          <input name="isActive" type="checkbox" defaultChecked={categoria.isActive} />
          Activa
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
        >
          {pendiente ? 'Guardando…' : 'Guardar categoría'}
        </button>
        {estado.error ? (
          <span role="alert" className="text-xs text-destructive">
            {estado.error}
          </span>
        ) : null}
        {estado.exito ? (
          <span role="status" className="text-xs text-status-green">
            {estado.exito}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function FormularioNuevaCategoria({ accion }: { accion: AccionFormulario }) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <form
      action={enviar}
      className="space-y-4 rounded-lg border border-dashed border-border p-4"
    >
      <h3 className="text-sm font-semibold">Nueva categoría</h3>
      <ErrorGeneral mensaje={estado.error} />
      {estado.exito ? <MensajeExito>{estado.exito}</MensajeExito> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <Campo
          etiqueta="Clave estable"
          nombre="clave"
          placeholder="Suministro crítico"
          ayuda="Se normaliza al guardar y después no cambia."
          errores={estado.errores?.['clave']}
          required
        />
        <Campo
          etiqueta="Nombre visible"
          nombre="nombre"
          placeholder="Suministro crítico"
          errores={estado.errores?.['nombre']}
          required
        />
        <label className="space-y-1.5 text-sm">
          <span className="block font-medium">Color</span>
          <input
            aria-label="Color de la nueva categoría"
            name="color"
            type="color"
            defaultValue="#2563eb"
            className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background p-1"
          />
        </label>
      </div>
      <div className="max-w-44">
        <BotonEnviar pendiente={pendiente}>Crear categoría</BotonEnviar>
      </div>
    </form>
  );
}

function MensajeExito({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-md border border-status-green/30 bg-status-green-subtle px-3 py-2 text-sm text-status-green"
    >
      {children}
    </p>
  );
}
