'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import type { EstadoContratos } from '@/app/(app)/[orgSlug]/contratos/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoContratos = {};

export function FormularioOrgano({
  accion,
  tipos,
  volverA,
}: {
  accion: (previo: EstadoContratos, formData: FormData) => Promise<EstadoContratos>;
  tipos: { valor: string; etiqueta: string }[];
  volverA: string;
}) {
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);
  const router = useRouter();

  // The action returns an empty state on success; navigate on from here rather
  // than redirecting server-side, so a validation failure can re-render in place.
  useEffect(() => {
    const exito = !estado.error && !estado.errores && estado !== INICIAL;
    if (exito) router.push(volverA);
  }, [estado, router, volverA]);

  return (
    <form action={enviar} className="space-y-6" noValidate>
      <ErrorGeneral mensaje={estado.error} />

      <Campo
        etiqueta="Nombre del órgano"
        nombre="nombre"
        required
        ayuda="Como aparece en los pliegos, p. ej. «Ayuntamiento de Alcalá de Guadaíra»."
        errores={estado.errores?.['nombre']}
      />

      <div className="space-y-1.5">
        <label htmlFor="tipo" className="block text-sm font-medium">
          Tipo
        </label>
        <select
          id="tipo"
          name="tipo"
          defaultValue="AYUNTAMIENTO"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {tipos.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.etiqueta}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="NIF" nombre="nif" errores={estado.errores?.['nif']} />
        <Campo
          etiqueta="Código DIR3"
          nombre="codigoDir3"
          ayuda="Identificador del Directorio Común."
          errores={estado.errores?.['codigoDir3']}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta="Comunidad autónoma"
          nombre="comunidadAutonoma"
          errores={estado.errores?.['comunidadAutonoma']}
        />
        <Campo
          etiqueta="Provincia"
          nombre="provincia"
          errores={estado.errores?.['provincia']}
        />
        <Campo
          etiqueta="Municipio"
          nombre="municipioNombre"
          errores={estado.errores?.['municipioNombre']}
        />
        <Campo
          etiqueta="Código INE del municipio"
          nombre="municipioIne"
          ayuda="Determina qué festivos locales se aplican a los plazos."
          errores={estado.errores?.['municipioIne']}
        />
      </div>

      <Campo
        etiqueta="Sede electrónica"
        nombre="sedeElectronicaUrl"
        type="url"
        placeholder="https://"
        errores={estado.errores?.['sedeElectronicaUrl']}
      />

      <div className="max-w-48">
        <BotonEnviar pendiente={pendiente}>Guardar órgano</BotonEnviar>
      </div>
    </form>
  );
}
