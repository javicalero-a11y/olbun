import Link from 'next/link';
import { notFound } from 'next/navigation';

import { can } from '@/lib/auth/can';
import { getSessionContext } from '@/lib/auth/session';
import type { Permission } from '@/lib/auth/permissions';

/**
 * M1 landing page. There is no product surface yet — contracts arrive in M4 and
 * expedientes in M5 — so this page shows the thing M1 actually delivers: who
 * you are, which organisation you are acting in, and exactly what your role
 * lets you do, read live from the permission matrix.
 */

interface Area {
  titulo: string;
  descripcion: string;
  hito: string;
  permiso: Permission;
  /** Set once the module exists; unset areas render as plain cards. */
  ruta?: string;
}

const AREAS: Area[] = [
  {
    titulo: 'Contratos',
    descripcion: 'Contratos públicos, modificados, prórrogas y penalidades.',
    hito: 'M4',
    permiso: 'contrato:view',
    ruta: 'contratos',
  },
  {
    titulo: 'Expedientes y plazos',
    descripcion: 'Cronología procesal, hitos y plazos con su fundamento.',
    hito: 'M5',
    permiso: 'expediente:view',
  },
  {
    titulo: 'Comunicaciones',
    descripcion: 'Bandeja de correspondencia vinculada a cada contrato.',
    hito: 'M6',
    permiso: 'comunicacion:view',
  },
  {
    titulo: 'Detecciones',
    descripcion: 'Señales que preceden a una reclamación, para revisar.',
    hito: 'M7',
    permiso: 'deteccion:review',
  },
  {
    titulo: 'Personal',
    descripcion: 'Plantilla, adscripción a contratos y cobertura.',
    hito: 'M11',
    permiso: 'empleado:view',
  },
  {
    titulo: 'Ausencias',
    descripcion: 'Bajas, absentismo y su impacto en la cobertura.',
    hito: 'M12',
    permiso: 'ausencia:view',
  },
  {
    titulo: 'Nómina',
    descripcion: 'Coste laboral, convenio y cálculo de nómina.',
    hito: 'M14',
    permiso: 'nomina:view',
  },
  {
    titulo: 'Facturación',
    descripcion: 'Facturas, morosidad e intereses de demora.',
    hito: 'M17',
    permiso: 'factura:view',
  },
  {
    titulo: 'Usuarios y equipo',
    descripcion: 'Quién tiene acceso, con qué rol, y a quién invitar.',
    hito: 'M1',
    permiso: 'user:list',
    ruta: 'ajustes/usuarios',
  },
];

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await getSessionContext(orgSlug);

  if (!contexto) notFound();

  const { actor, user, organisation } = contexto;
  const permitidas = AREAS.filter((area) => can(actor, area.permiso));
  const denegadas = AREAS.filter((area) => !can(actor, area.permiso));

  return (
    <div className="space-y-10">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {user.name.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Estás en <span className="font-medium text-foreground">{organisation.name}</span>.
        </p>
      </div>

      <section className="space-y-4" aria-labelledby="acceso-titulo">
        <div>
          <h2 id="acceso-titulo" className="text-sm font-semibold">
            Con tu rol puedes acceder a
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Calculado en vivo desde la matriz de permisos. Los módulos aún no están construidos;
            aquí se indica el hito en el que llegan.
          </p>
        </div>

        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {permitidas.map((area) => (
            <li key={area.titulo} className="rounded-lg border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-medium">
                  {area.ruta ? (
                    <Link
                      href={`/${orgSlug}/${area.ruta}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {area.titulo}
                    </Link>
                  ) : (
                    area.titulo
                  )}
                </h3>
                <span className="shrink-0 text-xs text-muted-foreground" data-numeric>
                  {area.hito}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {area.descripcion}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {denegadas.length > 0 ? (
        <section className="space-y-3" aria-labelledby="sin-acceso-titulo">
          <h2 id="sin-acceso-titulo" className="text-sm font-semibold text-muted-foreground">
            Fuera de tu rol
          </h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {denegadas.map((area) => (
              <li key={area.titulo}>{area.titulo}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="border-t border-border pt-6 text-xs text-muted-foreground">
        Hito M1 — identidad y multi-tenencia. Contratos llegan en M4, expedientes y plazos en
        M5.
      </p>
    </div>
  );
}
