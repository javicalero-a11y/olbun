import Link from 'next/link';
import type { Metadata } from 'next';

import { bolsaAnual } from '@/lib/services/jornada/registro';
import { can } from '@/lib/auth/can';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { ETIQUETAS_BOLSA } from '@/lib/domain/jornada/horas';
import { ETIQUETAS_ORIGEN } from '@/lib/validation/jornada';
import { hoyEn } from '@/lib/domain/fecha';
import { isScopedRole } from '@/lib/auth/permissions';
import { PanelJornada } from '@/components/features/jornada/panel-jornada';
import { registrar, verificar } from './acciones';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import type { EstadoBolsa } from '@/lib/domain/jornada/horas';

export const metadata: Metadata = { title: 'Registro de jornada' };

const CLASE_BOLSA: Readonly<Record<EstadoBolsa, string>> = {
  HOLGADA: 'text-status-green',
  CERCA_DEL_LIMITE: 'text-status-amber',
  EN_EL_LIMITE: 'text-status-amber',
  EXCEDIDA: 'text-destructive',
};

function fechaCorta(valor: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(valor);
}

/**
 * The working-time register (SPEC §4.9.5, M13).
 *
 * Compulsory since RD-ley 8/2019, and its absence is a serious infringement.
 * The screen shows what was recorded, what it adds up to against the annual
 * overtime ceiling, and — the part that makes the rest worth anything — a way
 * to prove the record has not been altered since.
 */
export default async function JornadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ empleado?: string }>;
}) {
  const { orgSlug } = await params;
  const { empleado: empleadoElegido } = await searchParams;
  const contexto = await requirePermission(orgSlug, 'jornada:view');
  const db = tenantClient(contexto.organisation.id);
  const scoped = isScopedRole(contexto.actor.role);
  const hoy = hoyEn();

  const empleados = await db.empleado.findMany({
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
  });

  const registros = await db.registroJornada.findMany({
    where: empleadoElegido ? { empleadoId: empleadoElegido } : {},
    select: {
      id: true,
      fecha: true,
      horaEntrada: true,
      horaSalida: true,
      horasOrdinarias: true,
      horasExtra: true,
      horasNocturnas: true,
      horasFestivas: true,
      origen: true,
      corrigeARegistroId: true,
      hashIntegridad: true,
      empleado: { select: { nombre: true, apellidos: true } },
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    take: 200,
  });

  const elegido = empleados.find((fila) => fila.id === empleadoElegido);
  const resumen = elegido ? await bolsaAnual(db, elegido.id, Number(hoy.slice(0, 4))) : null;

  const opciones = empleados.map((empleado) => ({
    id: empleado.id,
    nombre: `${empleado.apellidos}, ${empleado.nombre} · ${empleado.numeroEmpleado}`,
  }));

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${orgSlug}/personal`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Personal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Registro de jornada</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Obligatorio desde el RD-ley 8/2019 y su falta es infracción grave. Cada registro se
          sella con el anterior: no se puede editar, y por eso vale como prueba.
        </p>
      </header>

      {empleados.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no hay personal"
          explicacion="El registro de jornada se lleva por persona. Da de alta a alguien en Personal y podrás registrar y sellar sus jornadas aquí."
        />
      ) : (
        <>
          <PanelJornada
            registrar={registrar.bind(null, orgSlug)}
            verificar={verificar.bind(null, orgSlug)}
            empleados={opciones}
            hoy={hoy}
            puedeRegistrar={can(contexto.actor, 'jornada:manage')}
          />

          <form className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="empleado" className="block text-sm font-medium">
                Ver el registro de
              </label>
              <select
                id="empleado"
                name="empleado"
                defaultValue={empleadoElegido ?? ''}
                className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Todo el personal</option>
                {opciones.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.nombre}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md border border-input px-3 py-2 text-sm font-medium"
            >
              Filtrar
            </button>
          </form>

          {resumen ? (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <dt className="text-sm text-muted-foreground">Horas extra del año</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {resumen.horasExtraDelAnio.toFixed(2)}
                </dd>
              </div>
              <div className="rounded-lg border border-border p-4">
                <dt className="text-sm text-muted-foreground">Del límite anual</dt>
                <dd
                  className={`mt-1 text-2xl font-semibold tabular-nums ${CLASE_BOLSA[resumen.bolsa.estado]}`}
                >
                  {resumen.bolsa.porcentaje.toFixed(0)}%
                </dd>
              </div>
              <div className="rounded-lg border border-border p-4">
                <dt className="text-sm text-muted-foreground">Estado</dt>
                <dd className={`mt-1 text-sm font-medium ${CLASE_BOLSA[resumen.bolsa.estado]}`}>
                  {ETIQUETAS_BOLSA[resumen.bolsa.estado]}
                </dd>
              </div>
              <div className="rounded-lg border border-border p-4">
                <dt className="text-sm text-muted-foreground">Registros</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">
                  {resumen.registros}
                </dd>
              </div>
            </dl>
          ) : null}

          {resumen?.bolsa.requiereJustificacion ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-4 py-3 text-sm">
              Esta persona ha llegado al límite anual de 80 horas extra (art. 35.2 ET). Por
              encima hace falta una causa que lo ampare, no sólo un aviso.
            </p>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Registrado</h2>
            <Tabla
              titulo="Jornadas registradas, con su desglose de horas"
              anchoMinimo="960px"
              filas={registros}
              claveDeFila={(fila) => fila.id}
              vacio={
                <EstadoVacio
                  titulo="Todavía no hay jornadas registradas"
                  explicacion="Registrar la jornada diaria es obligatorio. Aquí aparecerá cada día con sus horas ordinarias, extra, nocturnas y festivas, sellado y sin posibilidad de editarlo."
                />
              }
              columnas={[
                {
                  clave: 'empleado',
                  encabezado: 'Persona',
                  esCabeceraDeFila: true,
                  celda: (fila) => `${fila.empleado.apellidos}, ${fila.empleado.nombre}`,
                },
                {
                  clave: 'fecha',
                  encabezado: 'Fecha',
                  clase: 'whitespace-nowrap',
                  celda: (fila) => (
                    <>
                      {fechaCorta(fila.fecha)}
                      {fila.corrigeARegistroId ? (
                        <p className="text-xs text-status-amber">Corrige a otro registro</p>
                      ) : null}
                    </>
                  ),
                },
                {
                  clave: 'horario',
                  encabezado: 'Horario',
                  clase: 'text-xs whitespace-nowrap tabular-nums',
                  celda: (fila) => `${fila.horaEntrada ?? '—'} – ${fila.horaSalida ?? '—'}`,
                },
                {
                  clave: 'ordinarias',
                  encabezado: 'Ordinarias',
                  numerica: true,
                  celda: (fila) => Number(fila.horasOrdinarias).toFixed(2),
                },
                {
                  clave: 'extra',
                  encabezado: 'Extra',
                  numerica: true,
                  celda: (fila) => Number(fila.horasExtra).toFixed(2),
                },
                {
                  clave: 'nocturnas',
                  encabezado: 'Nocturnas',
                  numerica: true,
                  celda: (fila) => Number(fila.horasNocturnas).toFixed(2),
                },
                {
                  clave: 'festivas',
                  encabezado: 'Festivas',
                  numerica: true,
                  celda: (fila) => Number(fila.horasFestivas).toFixed(2),
                },
                {
                  clave: 'origen',
                  encabezado: 'Origen',
                  clase: 'text-xs text-muted-foreground',
                  celda: (fila) => ETIQUETAS_ORIGEN[fila.origen],
                },
                {
                  clave: 'sello',
                  encabezado: 'Sello',
                  clase: 'text-xs text-muted-foreground',
                  // Los ocho primeros caracteres bastan para reconocerlo a
                  // simple vista; el sello entero está en la auditoría.
                  celda: (fila) => <code>{fila.hashIntegridad.slice(0, 8)}</code>,
                },
              ]}
            />
          </section>
        </>
      )}
    </div>
  );
}
