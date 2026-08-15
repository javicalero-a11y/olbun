import Link from 'next/link';
import type { Metadata } from 'next';

import { absentismoDelPeriodo, listarAusencias } from '@/lib/services/personal/ausencias';
import { can } from '@/lib/auth/can';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { hoyEn } from '@/lib/domain/fecha';
import { isScopedRole } from '@/lib/auth/permissions';
import { PanelAusencias } from '@/components/features/personal/panel-ausencias';
import { registrarAusencia } from './acciones';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { TIPOS_AUSENCIA } from '@/lib/domain/personal/ausencias';
import type { FechaCivil } from '@/lib/domain/fecha';

export const metadata: Metadata = { title: 'Ausencias' };

function fechaCorta(valor: Date | null): string {
  if (!valor) return '—';
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

/** First day of the month `fecha` falls in. */
function inicioDeMes(fecha: FechaCivil): FechaCivil {
  return `${fecha.slice(0, 7)}-01` as FechaCivil;
}

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  PREVISTA: { texto: 'Prevista', clase: 'text-muted-foreground' },
  ACTIVA: { texto: 'En curso', clase: 'text-status-amber' },
  CERRADA: { texto: 'Cerrada', clase: 'text-status-green' },
};

/**
 * Absences, and what they cost in coverage (M12).
 *
 * The absenteeism rate on this page counts only what absenteeism means: sick
 * leave, accidents and unjustified absence. Holidays, union hours and birth
 * and childcare leave remove availability and are excluded from the rate — a
 * number that swallowed them would say a compliant company fails every August,
 * and somebody would quote it in a meeting as though it did not.
 */
export default async function AusenciasPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'empleado:view');
  const db = tenantClient(contexto.organisation.id);
  const scoped = isScopedRole(contexto.actor.role);
  const hoy = hoyEn();

  const [empleados, ausencias, absentismo] = await Promise.all([
    db.empleado.findMany({
      where: {
        deletedAt: null,
        estado: 'ACTIVO',
        ...(scoped
          ? {
              adscripciones: {
                some: { contratoId: { in: [...contexto.actor.contratoIds] }, deletedAt: null },
              },
            }
          : {}),
      },
      select: { id: true, numeroEmpleado: true, nombre: true, apellidos: true },
      orderBy: { apellidos: 'asc' },
    }),
    listarAusencias(db, hoy),
    absentismoDelPeriodo(db, { desde: inicioDeMes(hoy), hasta: hoy }),
  ]);

  const puedeGestionar = can(contexto.actor, 'empleado:manage');
  const enCurso = ausencias.filter((fila) => fila.estadoVigente === 'ACTIVA');

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${orgSlug}/personal`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Personal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Ausencias y disponibilidad</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Lo que resta horas al servicio. Los días laborables se calculan al grabar contra el
          calendario de entonces, porque un festivo añadido después no puede reescribir un dato
          que ya se ha declarado.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-border p-4">
          <dt className="text-sm text-muted-foreground">Ausencias en curso</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">{enCurso.length}</dd>
        </div>
        <div className="rounded-lg border border-border p-4">
          <dt className="text-sm text-muted-foreground">Absentismo del mes</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {absentismo.porcentaje.toFixed(2)}%
          </dd>
        </div>
        <div className="rounded-lg border border-border p-4">
          <dt className="text-sm text-muted-foreground">Días computables</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {absentismo.diasComputables}
          </dd>
        </div>
        <div className="rounded-lg border border-border p-4">
          <dt className="text-sm text-muted-foreground">Días teóricos</dt>
          <dd className="mt-1 text-2xl font-semibold tabular-nums">
            {absentismo.diasTeoricos}
          </dd>
        </div>
      </dl>

      <p className="rounded-md bg-muted px-4 py-3 text-sm">
        El índice cuenta la IT, los accidentes y la ausencia injustificada. Las vacaciones, el
        crédito sindical y los permisos por nacimiento y cuidado restan disponibilidad pero{' '}
        <strong>no son absentismo</strong> y no entran en el porcentaje.
      </p>

      {absentismo.porTipo.length > 0 ? (
        <ul className="flex flex-wrap gap-2 text-xs">
          {absentismo.porTipo.map((fila) => (
            <li key={fila.tipo} className="rounded-full border border-border px-3 py-1">
              {TIPOS_AUSENCIA[fila.tipo].etiqueta}: {fila.dias}{' '}
              {fila.dias === 1 ? 'día' : 'días'}
            </li>
          ))}
        </ul>
      ) : null}

      {puedeGestionar ? (
        <PanelAusencias
          registrar={registrarAusencia.bind(null, orgSlug)}
          empleados={empleados.map((empleado) => ({
            id: empleado.id,
            nombre: `${empleado.apellidos}, ${empleado.nombre} · ${empleado.numeroEmpleado}`,
          }))}
        />
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Registradas</h2>
        <Tabla
          titulo="Ausencias registradas, con sus días naturales y laborables"
          anchoMinimo="900px"
          filas={ausencias}
          claveDeFila={(fila) => fila.id}
          vacio={
            <EstadoVacio
              titulo="Todavía no hay ausencias"
              explicacion="Aquí van las bajas, las vacaciones y los permisos. Sin ellas la cobertura de un contrato es sólo quién está adscrito en el papel, no quién estuvo el día que vino la inspección."
            />
          }
          columnas={[
            {
              clave: 'empleado',
              encabezado: 'Persona',
              esCabeceraDeFila: true,
              celda: (fila) => (
                <>
                  {fila.empleado.apellidos}, {fila.empleado.nombre}
                  <p className="text-xs text-muted-foreground">
                    {fila.empleado.numeroEmpleado}
                  </p>
                </>
              ),
            },
            {
              clave: 'tipo',
              encabezado: 'Tipo',
              celda: (fila) => (
                <>
                  {fila.etiqueta}
                  {fila.subtipo ? (
                    <p className="text-xs text-muted-foreground">{fila.subtipo}</p>
                  ) : null}
                  {fila.computaAbsentismo ? null : (
                    <p className="text-xs text-muted-foreground">No computa absentismo</p>
                  )}
                </>
              ),
            },
            {
              clave: 'desde',
              encabezado: 'Desde',
              clase: 'text-xs whitespace-nowrap',
              celda: (fila) => fechaCorta(fila.fechaInicio),
            },
            {
              clave: 'hasta',
              encabezado: 'Hasta',
              clase: 'text-xs whitespace-nowrap',
              celda: (fila) =>
                fila.fechaFinReal
                  ? fechaCorta(fila.fechaFinReal)
                  : fila.fechaFinPrevista
                    ? `${fechaCorta(fila.fechaFinPrevista)} (previsto)`
                    : 'Sin fecha de fin',
            },
            {
              clave: 'naturales',
              encabezado: 'Naturales',
              numerica: true,
              celda: (fila) => fila.diasNaturales,
            },
            {
              clave: 'laborables',
              encabezado: 'Laborables',
              numerica: true,
              celda: (fila) => fila.diasLaborables,
            },
            {
              clave: 'estado',
              encabezado: 'Estado',
              celda: (fila) => {
                const etiqueta = ETIQUETA_ESTADO[fila.estadoVigente];
                return (
                  <span className={`text-xs ${etiqueta?.clase ?? ''}`}>
                    {etiqueta?.texto ?? fila.estadoVigente}
                    {fila.abierta ? ' · abierta' : ''}
                  </span>
                );
              },
            },
            {
              clave: 'sustitucion',
              encabezado: 'Sustitución',
              clase: 'text-xs text-muted-foreground',
              celda: (fila) => (fila.requiereSustitucion ? 'Hay que cubrirla' : 'No procede'),
            },
          ]}
        />
      </section>
    </div>
  );
}
