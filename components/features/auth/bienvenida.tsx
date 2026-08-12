'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import {
  aceptarInvitacion,
  crearOrganizacion,
  type EstadoBienvenida,
} from '@/app/(auth)/bienvenida/acciones';
import { BotonEnviar, Campo, ErrorGeneral } from '@/components/features/auth/campo';

const INICIAL: EstadoBienvenida = {};

interface InvitacionVista {
  membershipId: string;
  organisationName: string;
  rol: string;
  invitadoPor: string | null;
}

function Invitacion({ invitacion }: { invitacion: InvitacionVista }) {
  const accion = aceptarInvitacion.bind(null, invitacion.membershipId);
  const [estado, enviar, pendiente] = useActionState(accion, INICIAL);

  return (
    <li className="rounded-md border border-border px-3 py-3">
      <p className="text-sm font-medium">{invitacion.organisationName}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {invitacion.invitadoPor
          ? `${invitacion.invitadoPor} te invita como ${invitacion.rol.toLowerCase()}.`
          : `Te han invitado como ${invitacion.rol.toLowerCase()}.`}
      </p>

      {estado.error ? (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {estado.error}
        </p>
      ) : null}

      <form action={enviar} className="mt-2.5">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {pendiente ? 'Entrando…' : 'Aceptar y entrar'}
        </button>
      </form>
    </li>
  );
}

export function Bienvenida({
  nombre,
  organizaciones,
  invitaciones,
}: {
  nombre: string;
  organizaciones: { slug: string; name: string; rol: string }[];
  invitaciones: InvitacionVista[];
}) {
  const [estado, enviar, pendiente] = useActionState(crearOrganizacion, INICIAL);
  const primerNombre = nombre.split(' ')[0];

  return (
    <div className="space-y-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          {primerNombre ? `Hola, ${primerNombre}` : 'Hola'}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ya has entrado. Sólo falta decidir dónde vas a trabajar.
        </p>
      </div>

      {organizaciones.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">Tus organizaciones</h2>
          <ul className="space-y-2">
            {organizaciones.map((o) => (
              <li key={o.slug} className="rounded-md border border-border px-3 py-3">
                <Link href={`/${o.slug}`} className="text-sm font-medium hover:underline">
                  {o.name}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.rol}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {invitaciones.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {invitaciones.length === 1 ? 'Tienes una invitación' : 'Tienes invitaciones'}
          </h2>
          <ul className="space-y-2">
            {invitaciones.map((i) => (
              <Invitacion key={i.membershipId} invitacion={i} />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">
            {invitaciones.length > 0 || organizaciones.length > 0
              ? 'O crea la tuya'
              : 'Crea tu organización'}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Serás su propietario, y podrás invitar después a quien trabaje contigo.
          </p>
        </div>

        <form action={enviar} className="space-y-4" noValidate>
          <ErrorGeneral mensaje={estado.error} />

          <Campo
            nombre="empresa"
            etiqueta="Empresa u organismo"
            errores={estado.errores?.['empresa']}
            required
          />

          {/* Only asked when we do not have a real one: a magic-link account
              starts with a placeholder taken from the email address. */}
          <Campo
            nombre="nombre"
            etiqueta="Tu nombre"
            defaultValue={nombre}
            errores={estado.errores?.['nombre']}
            ayuda="Es el nombre que verán tus compañeros."
          />

          <BotonEnviar pendiente={pendiente}>Crear organización</BotonEnviar>
        </form>
      </section>
    </div>
  );
}
