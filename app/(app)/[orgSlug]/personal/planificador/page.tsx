import Link from 'next/link';
import type { Metadata } from 'next';

import { EstadoVacio } from '@/components/ui/tabla';
import { ETIQUETAS_CELDA } from '@/lib/domain/personal/planificador';
import { hoyEn } from '@/lib/domain/fecha';
import {
  planificadorDeContrato,
  ventanaPorDefecto,
} from '@/lib/services/personal/planificador';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import type { Celda, EstadoCelda } from '@/lib/domain/personal/planificador';

export const metadata: Metadata = { title: 'Planificador de cobertura' };

/**
 * The coverage planner (SPEC §5.6, M12).
 *
 * People down, weeks across. The grid earns its place by showing the one thing
 * a list cannot: somebody committed to two contracts at sixty per cent each is
 * over-assigned on paper long before anyone notices on the ground.
 *
 * Read-only on purpose. SPEC describes dragging assignments around, and that
 * owes a keyboard equivalent designed alongside it (WCAG 2.2 AA, 2.5.7).
 * Assignments are edited through the form that already exists; shipping the
 * drag first would have meant shipping the inaccessible half first.
 */

/** Colour *and* text, never colour alone — public buyers audit this. */
const ESTILO_CELDA: Readonly<Record<EstadoCelda, string>> = {
  LIBRE: 'bg-muted/40 text-muted-foreground',
  CUBIERTO: 'bg-status-green-subtle text-status-green',
  AUSENTE: 'bg-status-amber-subtle text-status-amber',
  SOBREASIGNADO: 'bg-destructive/10 text-destructive',
};

function diaYMes(fecha: string): string {
  const [, mes = '', dia = ''] = fecha.split('-');
  return `${dia}/${mes}`;
}

export default async function PlanificadorPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ contrato?: string }>;
}) {
  const { orgSlug } = await params;
  const { contrato: contratoId } = await searchParams;
  const contexto = await requirePermission(orgSlug, 'empleado:view');
  const db = tenantClient(contexto.organisation.id);
  const hoy = hoyEn();

  const contratos = await db.contrato.findMany({
    where: { deletedAt: null, estado: { in: ['EN_EJECUCION', 'FORMALIZADO'] } },
    select: { id: true, numeroExpediente: true, objeto: true },
    orderBy: { numeroExpediente: 'desc' },
    take: 100,
  });

  const elegido = contratos.find((fila) => fila.id === contratoId) ?? contratos[0];
  const periodo = ventanaPorDefecto(hoy);
  const plan = elegido ? await planificadorDeContrato(db, elegido.id, periodo) : null;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href={`/${orgSlug}/personal`}
          className="text-xs font-medium text-primary hover:underline"
        >
          ← Personal
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Planificador de cobertura</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Personas y semanas, con lo comprometido y lo que se lleva una ausencia. Se lee: las
          adscripciones se editan en su formulario, porque arrastrar exige un equivalente por
          teclado y media función es peor que ninguna.
        </p>
      </header>

      {contratos.length === 0 ? (
        <EstadoVacio
          titulo="No hay contratos en ejecución"
          explicacion="El planificador trabaja sobre un contrato vivo: sus adscripciones y las ausencias de quienes lo prestan. Formaliza un contrato y adscribe a alguien para verlo aquí."
        />
      ) : (
        <>
          <form className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor="contrato" className="block text-sm font-medium">
                Contrato
              </label>
              <select
                id="contrato"
                name="contrato"
                defaultValue={elegido?.id}
                className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {contratos.map((fila) => (
                  <option key={fila.id} value={fila.id}>
                    {fila.numeroExpediente} — {fila.objeto.slice(0, 60)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="rounded-md border border-input px-3 py-2 text-sm font-medium"
            >
              Ver
            </button>
          </form>

          {plan?.proyeccion.fiable ? (
            <p className="rounded-md bg-muted px-4 py-3 text-sm">
              Con el absentismo de los tres meses anteriores en este contrato (
              {(plan.proyeccion.tasaHistorica * 100).toFixed(1)} %), de las{' '}
              <strong>{plan.proyeccion.horasPlanificadas.toFixed(0)} h</strong> planificadas
              cabe esperar que queden sin cubrir unas{' '}
              <strong>{plan.proyeccion.horasEnRiesgo.toFixed(0)} h</strong>. Es una
              multiplicación, no un modelo: sirve para discutirla, no para creérsela.
            </p>
          ) : (
            <p className="rounded-md bg-muted px-4 py-3 text-sm">
              Todavía no hay historia suficiente en este contrato para proyectar nada. Una tasa
              sacada de una semana suelta se acabaría citando en una reunión como si significara
              algo.
            </p>
          )}

          {plan?.sinPlantilla ? (
            <EstadoVacio
              titulo="Nadie adscrito a este contrato"
              explicacion="El planificador enseña a las personas que lo prestan, semana a semana. Adscribe a alguien desde Plantilla y adscripción y aparecerá aquí."
            />
          ) : (
            <>
              <ul className="flex flex-wrap gap-3 text-xs">
                {(Object.keys(ETIQUETAS_CELDA) as EstadoCelda[]).map((estado) => (
                  <li key={estado} className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className={`inline-block h-3 w-3 rounded-sm ${ESTILO_CELDA[estado]}`}
                    />
                    {ETIQUETAS_CELDA[estado]}
                  </li>
                ))}
              </ul>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm" style={{ minWidth: '900px' }}>
                  <caption className="sr-only">
                    Horas comprometidas y disponibles de cada persona, semana a semana
                  </caption>
                  <thead>
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-4 font-medium">
                        Persona
                      </th>
                      {plan?.semanas.map((semana) => (
                        <th
                          key={semana.desde}
                          scope="col"
                          className="py-2 pr-2 text-right font-medium tabular-nums"
                        >
                          {diaYMes(semana.desde)}
                        </th>
                      ))}
                      <th scope="col" className="py-2 text-right font-medium">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan?.filas.map((fila) => (
                      <tr key={fila.empleadoId} className="border-b border-border/60">
                        <th scope="row" className="py-2 pr-4 font-normal">
                          {fila.nombre}
                          {fila.tieneSobreasignacion ? (
                            <span className="block text-xs text-destructive">
                              Sobreasignado alguna semana
                            </span>
                          ) : null}
                        </th>
                        {fila.celdas.map((celda) => (
                          <td key={celda.semana.desde} className="py-1 pr-2">
                            <Celdilla celda={celda} />
                          </td>
                        ))}
                        <td className="py-2 text-right tabular-nums">
                          {fila.totalDisponibles.toFixed(0)} h
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * One cell.
 *
 * The number is the hours available; the state is spelled out in the title and
 * in visually hidden text, so it is never carried by colour alone.
 */
function Celdilla({ celda }: { celda: Celda }) {
  const etiqueta = ETIQUETAS_CELDA[celda.estado];
  const detalle =
    celda.motivos.length > 0 ? `${etiqueta}: ${celda.motivos.join(', ')}` : etiqueta;

  return (
    <span
      title={`${detalle}. ${celda.disponibles.toFixed(0)} h disponibles de ${celda.comprometidas.toFixed(0)} h comprometidas.`}
      className={`flex flex-col rounded-sm px-2 py-1 text-right tabular-nums ${ESTILO_CELDA[celda.estado]}`}
    >
      <span className="text-sm">{celda.disponibles.toFixed(0)}</span>
      <span className="text-[10px] leading-tight">{etiqueta}</span>
      <span className="sr-only">
        {detalle}. {celda.disponibles.toFixed(0)} horas disponibles de{' '}
        {celda.comprometidas.toFixed(0)} comprometidas.
      </span>
    </span>
  );
}
