import Link from 'next/link';
import { notFound } from 'next/navigation';

import { can } from '@/lib/auth/can';
import { ETIQUETA_ROL } from '@/lib/auth/etiquetas';
import { getSessionContext } from '@/lib/auth/session';
import { tenantClient } from '@/lib/db/tenant';
import type { Permission } from '@/lib/auth/permissions';

/**
 * The organisation dashboard.
 *
 * Two columns: what this organisation *is* on the left, what needs attention
 * on the right. The indicators are counted live rather than illustrated —
 * a panel of flags that does not reflect the data is worse than no panel,
 * because people stop reading it and then miss the one that mattered.
 */

interface Area {
  titulo: string;
  descripcion: string;
  hito: string;
  permiso: Permission;
  /** Set once the module exists; unset areas render without a link. */
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
    ruta: 'expedientes',
  },
  {
    titulo: 'Comunicaciones',
    descripcion: 'Bandeja de correspondencia vinculada a cada contrato.',
    hito: 'M6',
    permiso: 'comunicacion:view',
    ruta: 'comunicaciones',
  },
  {
    titulo: 'Detecciones',
    descripcion: 'Señales que preceden a una reclamación, para revisar.',
    hito: 'M7',
    permiso: 'deteccion:review',
    ruta: 'detecciones',
  },
  {
    titulo: 'Incidencias',
    descripcion: 'Lo que ha pasado: fallos, quejas, accidentes y daños.',
    hito: 'M10',
    permiso: 'incidencia:view',
    ruta: 'incidencias',
  },
  {
    titulo: 'Riesgos',
    descripcion: 'Lo que no ha pasado, con su probabilidad y su impacto.',
    hito: 'M10',
    permiso: 'riesgo:view',
    ruta: 'riesgos',
  },
  {
    titulo: 'Documentos',
    descripcion: 'Pliegos, actas y resoluciones, con sus versiones.',
    hito: 'M9',
    permiso: 'documento:view',
    ruta: 'documentos',
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

type Tono = 'rojo' | 'ambar' | 'verde';

const TONO: Readonly<Record<Tono, string>> = {
  rojo: 'border-destructive/25 bg-destructive/10 text-destructive',
  ambar: 'border-status-amber/30 bg-status-amber-subtle text-status-amber',
  verde: 'border-status-green/30 bg-status-green-subtle text-status-green',
};

/** Colour is paired with a shape and a sentence, never used alone. */
const MARCA: Readonly<Record<Tono, string>> = { rojo: '⚑', ambar: '⚑', verde: '⚑' };

function Indicador({ tono, texto }: { tono: Tono; texto: string }) {
  return (
    <li
      className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${TONO[tono]}`}
    >
      <span aria-hidden="true" className="leading-5">
        {MARCA[tono]}
      </span>
      <span className="leading-5">{texto}</span>
    </li>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd className="mt-0.5 text-base font-semibold">{children}</dd>
    </div>
  );
}

export default async function OrgHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await getSessionContext(orgSlug);

  if (!contexto) notFound();

  const { actor, user, organisation } = contexto;
  const db = tenantClient(organisation.id);

  const dentroDeQuince = new Date();
  dentroDeQuince.setDate(dentroDeQuince.getDate() + 15);

  const [detecciones, plazos, riesgosSinValorar, incidenciasAbiertas, contratos, expedientes] =
    await Promise.all([
      db.deteccion.count({ where: { estado: 'NUEVA', deletedAt: null } }),
      db.plazo.count({
        where: {
          estado: 'VIGENTE',
          deletedAt: null,
          fechaVencimientoCalculada: { lte: dentroDeQuince },
        },
      }),
      db.riesgo.count({
        where: { deletedAt: null, probabilidadResidual: null, estado: { not: 'CERRADO' } },
      }),
      db.incidencia.count({ where: { estado: 'ABIERTA', deletedAt: null } }),
      db.contrato.count({ where: { deletedAt: null } }),
      db.expediente.count({ where: { deletedAt: null } }),
    ]);

  const indicadores: { tono: Tono; texto: string }[] = [];

  if (plazos > 0) {
    indicadores.push({
      tono: 'rojo',
      texto: `${String(plazos)} ${plazos === 1 ? 'plazo vence' : 'plazos vencen'} en los próximos 15 días`,
    });
  }
  if (detecciones > 0) {
    indicadores.push({
      tono: 'ambar',
      texto: `${String(detecciones)} ${detecciones === 1 ? 'detección' : 'detecciones'} sin revisar`,
    });
  }
  if (incidenciasAbiertas > 0) {
    indicadores.push({
      tono: 'ambar',
      texto: `${String(incidenciasAbiertas)} ${incidenciasAbiertas === 1 ? 'incidencia abierta' : 'incidencias abiertas'}`,
    });
  }
  if (riesgosSinValorar > 0) {
    indicadores.push({
      tono: 'ambar',
      texto: `${String(riesgosSinValorar)} ${riesgosSinValorar === 1 ? 'riesgo' : 'riesgos'} sin valorar el residual`,
    });
  }
  if (indicadores.length === 0) {
    indicadores.push({ tono: 'verde', texto: 'Nada pendiente de atención inmediata' });
  }

  const permitidas = AREAS.filter((area) => can(actor, area.permiso));
  const denegadas = AREAS.filter((area) => !can(actor, area.permiso));

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{organisation.name}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Hola, {user.name.split(' ')[0]}. Esto es lo que hay abierto ahora mismo y lo que tu
            rol te deja tocar.
          </p>

          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            <Dato etiqueta="Tu rol">{ETIQUETA_ROL[actor.role]}</Dato>
            <Dato etiqueta="Contratos">{contratos}</Dato>
            <Dato etiqueta="Expedientes">{expedientes}</Dato>
            <Dato etiqueta="Áreas a tu alcance">
              {permitidas.length}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                de {AREAS.length}
              </span>
            </Dato>
          </dl>

          <div className="mt-8 border-t border-border pt-5">
            <Link
              href={`/${orgSlug}/ajustes`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ajustes de la organización →
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="indicadores-titulo"
          className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <h2 id="indicadores-titulo" className="text-lg font-semibold">
            Qué necesita atención
          </h2>

          <ul className="mt-5 space-y-2">
            {indicadores.map((indicador) => (
              <Indicador key={indicador.texto} tono={indicador.tono} texto={indicador.texto} />
            ))}
          </ul>

          <div className="mt-6 border-t border-border pt-5">
            <Link
              href={`/${orgSlug}/plazos`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver el calendario de plazos →
            </Link>
          </div>
        </section>
      </div>

      <section
        aria-labelledby="acceso-titulo"
        className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
      >
        <h2 id="acceso-titulo" className="text-lg font-semibold">
          Con tu rol puedes acceder a
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Calculado en vivo desde la matriz de permisos. Los módulos que aún no existen indican
          el hito en el que llegan.
        </p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

        {denegadas.length > 0 ? (
          <div className="mt-6 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-muted-foreground">Fuera de tu rol</h3>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {denegadas.map((area) => (
                <li key={area.titulo}>{area.titulo}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
