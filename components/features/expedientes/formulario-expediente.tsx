'use client';

import { useActionState, useState } from 'react';

import type { EstadoExpedientes } from '@/app/(app)/[orgSlug]/expedientes/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoExpedientes = {};

interface Opcion {
  valor: string;
  etiqueta: string;
}

export interface PlantillaOpcion {
  id: string;
  nombre: string;
  tipo: string;
  jurisdiccion: string;
  descripcion?: string | undefined;
  /** Shown before opening, so nobody is surprised by what gets created. */
  pasos: { nombre: string; plazo?: string | undefined }[];
}

function Seleccion({
  nombre,
  etiqueta,
  opciones,
  valor,
  alCambiar,
  errores,
  ayuda,
}: {
  nombre: string;
  etiqueta: string;
  opciones: Opcion[];
  valor?: string;
  alCambiar?: (valor: string) => void;
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
        value={valor}
        onChange={
          alCambiar
            ? (e) => {
                alCambiar(e.target.value);
              }
            : undefined
        }
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

export function FormularioExpediente({
  accion,
  plantillas,
  contratos,
  tipos,
  jurisdicciones,
  hoy,
}: {
  accion: (previo: EstadoExpedientes, formData: FormData) => Promise<EstadoExpedientes>;
  plantillas: PlantillaOpcion[];
  contratos: Opcion[];
  tipos: Opcion[];
  jurisdicciones: Opcion[];
  hoy: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const [plantillaId, setPlantillaId] = useState('');

  const elegida = plantillas.find((p) => p.id === plantillaId);

  // Choosing a template also fixes the type and the jurisdiction: they are
  // properties of the procedure, not free choices, and letting them disagree
  // would produce an expediente whose deadlines cite the wrong law.
  const [tipo, setTipo] = useState(tipos[0]?.valor ?? '');
  const [jurisdiccion, setJurisdiccion] = useState(jurisdicciones[0]?.valor ?? '');

  function elegirPlantilla(id: string) {
    setPlantillaId(id);
    const plantilla = plantillas.find((p) => p.id === id);
    if (plantilla) {
      setTipo(plantilla.tipo);
      setJurisdiccion(plantilla.jurisdiccion);
    }
  }

  return (
    <form action={enviar} className="space-y-8" noValidate>
      <ErrorGeneral mensaje={estado.error} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight">Procedimiento</h2>

        <Seleccion
          nombre="plantillaId"
          etiqueta="Plantilla"
          valor={plantillaId}
          alCambiar={elegirPlantilla}
          opciones={[
            { valor: '', etiqueta: 'Sin plantilla — lo montaré a mano' },
            ...plantillas.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
          ]}
          errores={estado.errores?.['plantillaId']}
          ayuda="La plantilla crea de golpe todos los hitos del procedimiento y calcula sus plazos."
        />

        {elegida ? (
          <div className="rounded-md border border-border px-3 py-2.5">
            <p className="text-xs font-medium">Se crearán estos hitos</p>
            <ol className="mt-1.5 space-y-1">
              {elegida.pasos.map((paso, indice) => (
                <li key={paso.nombre} className="text-xs text-muted-foreground">
                  <span data-numeric>{indice + 1}.</span> {paso.nombre}
                  {paso.plazo ? <span className="text-foreground"> — {paso.plazo}</span> : null}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted-foreground">
              Las fechas se calculan a partir de la fecha de apertura y quedan marcadas como
              pendientes de confirmar.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Seleccion
            nombre="tipo"
            etiqueta="Tipo"
            opciones={tipos}
            valor={tipo}
            alCambiar={setTipo}
            errores={estado.errores?.['tipo']}
          />
          <Seleccion
            nombre="jurisdiccion"
            etiqueta="Vía"
            opciones={jurisdicciones}
            valor={jurisdiccion}
            alCambiar={setJurisdiccion}
            errores={estado.errores?.['jurisdiccion']}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold tracking-tight">El asunto</h2>

        <Campo
          nombre="titulo"
          etiqueta="Título"
          errores={estado.errores?.['titulo']}
          required
        />

        <Campo
          nombre="fechaApertura"
          etiqueta="Fecha de apertura"
          type="date"
          defaultValue={hoy}
          errores={estado.errores?.['fechaApertura']}
          ayuda="La fecha desde la que corren los plazos: normalmente la fecha en que surtió efecto la notificación, no la de hoy."
          required
        />

        <Seleccion
          nombre="contratoId"
          etiqueta="Contrato"
          opciones={[{ valor: '', etiqueta: 'Ninguno' }, ...contratos]}
          errores={estado.errores?.['contratoId']}
          ayuda="El municipio del órgano del contrato decide qué calendario de festivos se aplica."
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            nombre="organoCompetente"
            etiqueta="Órgano competente"
            errores={estado.errores?.['organoCompetente']}
          />
          <Campo
            nombre="parteContraria"
            etiqueta="Parte contraria"
            errores={estado.errores?.['parteContraria']}
          />
        </div>

        <Campo
          nombre="cuantia"
          etiqueta="Cuantía (€)"
          errores={estado.errores?.['cuantia']}
          ayuda="Déjalo en blanco si todavía no se conoce."
        />

        <div className="space-y-1.5">
          <label htmlFor="resumen" className="block text-sm font-medium">
            Resumen
          </label>
          <textarea
            id="resumen"
            name="resumen"
            rows={4}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <p className="text-xs text-muted-foreground">
            Qué ha pasado, en dos líneas, para quien abra esto dentro de seis meses.
          </p>
        </div>
      </section>

      <BotonEnviar pendiente={pendiente}>Abrir expediente</BotonEnviar>
    </form>
  );
}
