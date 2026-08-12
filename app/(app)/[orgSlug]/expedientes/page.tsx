import type { Metadata } from 'next';
import Link from 'next/link';

import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { avisoMasUrgente, type PlazoEvaluable } from '@/lib/domain/expedientes/avisos';
import {
  ETIQUETA_ESTADO_EXPEDIENTE,
  ETIQUETA_TIPO_EXPEDIENTE,
} from '@/lib/domain/expedientes/etiquetas';
import { formatearEuros } from '@/lib/domain/contratos/etiquetas';
import { hoyEn, type FechaCivil } from '@/lib/domain/fecha';
import { EtiquetaPlazo } from '@/components/features/expedientes/aviso-plazo';

export const metadata: Metadata = { title: 'Expedientes' };

function aCivil(valor: Date): FechaCivil;
function aCivil(valor: Date | null): FechaCivil | undefined;
function aCivil(valor: Date | null): FechaCivil | undefined {
  return valor ? valor.toISOString().slice(0, 10) : undefined;
}

export default async function ExpedientesPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'expediente:view');
  const db = tenantClient(contexto.organisation.id);

  const expedientes = await db.expediente.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      referencia: true,
      titulo: true,
      tipo: true,
      estado: true,
      cuantia: true,
      fechaApertura: true,
      contrato: { select: { numeroExpediente: true } },
      plazos: {
        where: { deletedAt: null },
        select: {
          id: true,
          descripcion: true,
          fundamento: true,
          cantidad: true,
          computo: true,
          fechaInicio: true,
          fechaVencimientoCalculada: true,
          fechaVencimientoConfirmada: true,
          esPreclusivo: true,
          calculoCompleto: true,
          advertencias: true,
          estado: true,
        },
      },
    },
    orderBy: { fechaApertura: 'desc' },
  });

  const hoy = hoyEn(contexto.organisation.timezone);
  const puedeCrear = can(contexto.actor, 'expediente:create');

  // Sorted by what is about to bite, not by when it was opened: an expediente
  // with a preclusive deadline three days out belongs at the top whatever its
  // age.
  const filas = expedientes
    .map((expediente) => {
      const plazos: PlazoEvaluable[] = expediente.plazos.map((plazo) => ({
        id: plazo.id,
        descripcion: plazo.descripcion,
        fundamento: plazo.fundamento,
        cantidad: plazo.cantidad,
        computo: plazo.computo,
        fechaInicio: aCivil(plazo.fechaInicio),
        fechaVencimientoCalculada: aCivil(plazo.fechaVencimientoCalculada),
        fechaVencimientoConfirmada: aCivil(plazo.fechaVencimientoConfirmada),
        esPreclusivo: plazo.esPreclusivo,
        calculoCompleto: plazo.calculoCompleto,
        advertencias: plazo.advertencias,
        estado: plazo.estado,
      }));

      return { expediente, aviso: avisoMasUrgente(plazos, hoy) };
    })
    .sort((a, b) => {
      if (a.aviso && b.aviso) return a.aviso.diasRestantes - b.aviso.diasRestantes;
      if (a.aviso) return -1;
      if (b.aviso) return 1;
      return b.expediente.fechaApertura.getTime() - a.expediente.fechaApertura.getTime();
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expedientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {expedientes.length === 0
              ? 'Todavía no hay ninguno.'
              : expedientes.length === 1
                ? 'Un expediente.'
                : `${String(expedientes.length)} expedientes.`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/${orgSlug}/plazos`}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium"
          >
            Ver plazos
          </Link>
          {puedeCrear ? (
            <Link href={`/${orgSlug}/expedientes/nuevo`} className="boton-primario">
              Nuevo expediente
            </Link>
          ) : null}
        </div>
      </div>

      {expedientes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h2 className="text-sm font-semibold">Aquí vivirán tus expedientes</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Una penalidad, un recurso, un impago o un despido: cada uno se abre desde una
            plantilla de procedimiento, que crea de golpe todos sus hitos y calcula sus plazos
            con el fundamento legal al lado de cada fecha.
          </p>
          {puedeCrear ? (
            <Link
              href={`/${orgSlug}/expedientes/nuevo`}
              className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-4"
            >
              Abrir el primero
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <caption className="sr-only">
              Expedientes de la organización, ordenados por urgencia del plazo más próximo
            </caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Referencia
                </th>
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Tipo
                </th>
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Contrato
                </th>
                <th scope="col" className="pr-4 pb-2 font-medium">
                  Estado
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Cuantía
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map(({ expediente, aviso }) => {
                const estado = ETIQUETA_ESTADO_EXPEDIENTE[expediente.estado];

                return (
                  <tr
                    key={expediente.id}
                    className="border-b border-border align-top last:border-0"
                  >
                    <td className="py-3 pr-4">
                      <Link
                        href={`/${orgSlug}/expedientes/${expediente.id}`}
                        className="text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {expediente.referencia}
                      </Link>
                      <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
                        {expediente.titulo}
                      </p>
                      {aviso ? (
                        <p className="mt-1">
                          <EtiquetaPlazo aviso={aviso} />
                        </p>
                      ) : null}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {ETIQUETA_TIPO_EXPEDIENTE[expediente.tipo] ?? expediente.tipo}
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">
                      {expediente.contrato?.numeroExpediente ?? '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs font-medium ${estado?.clase ?? ''}`}>
                        {estado?.texto ?? expediente.estado}
                      </span>
                    </td>
                    <td className="py-3 text-right text-xs" data-numeric>
                      {formatearEuros(expediente.cuantia ? Number(expediente.cuantia) : null)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
