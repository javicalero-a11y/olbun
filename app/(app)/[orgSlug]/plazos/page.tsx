import type { Metadata } from 'next';
import Link from 'next/link';

import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { avisosDePlazos, type PlazoEvaluable } from '@/lib/domain/expedientes/avisos';
import { describirComputo } from '@/lib/domain/expedientes/etiquetas';
import { EtiquetaPlazo } from '@/components/features/expedientes/aviso-plazo';
import { formatearEs, hoyEn, type FechaCivil } from '@/lib/domain/fecha';

export const metadata: Metadata = { title: 'Plazos' };
// This page is an operational alarm, not a report snapshot. It must never
// reuse the empty response a browser saw immediately before creating a plazo.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function aCivil(valor: Date): FechaCivil;
function aCivil(valor: Date | null): FechaCivil | undefined;
function aCivil(valor: Date | null): FechaCivil | undefined {
  return valor ? valor.toISOString().slice(0, 10) : undefined;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function tituloDeMes(fecha: FechaCivil): string {
  const mes = MESES[Number(fecha.slice(5, 7)) - 1] ?? '';
  return `${mes} de ${fecha.slice(0, 4)}`;
}

/**
 * Every live deadline in the organisation, grouped by month.
 *
 * A month grid was the obvious design and the wrong one: what someone needs
 * here is "what is coming at me, soonest first, and what happens if I miss
 * it", which a chronological list answers directly and a grid of squares
 * obscures. Overdue deadlines lead, because those are already a problem.
 */
export default async function PlazosPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'plazo:view');
  const db = tenantClient(contexto.organisation.id);

  const plazos = await db.plazo.findMany({
    where: { deletedAt: null },
    include: {
      expediente: { select: { id: true, referencia: true, titulo: true } },
    },
  });

  const hoy = hoyEn(contexto.organisation.timezone);

  const porId = new Map(plazos.map((plazo) => [plazo.id, plazo]));

  const evaluables: PlazoEvaluable[] = plazos.map((plazo) => ({
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

  const avisos = avisosDePlazos(evaluables, hoy).filter((a) => a.nivel !== 'CERRADO');

  // Chronological within the page, but overdue first: the order that matches
  // what a person has to do about them.
  const vencidos = avisos.filter((a) => a.diasRestantes < 0);
  const proximos = [...avisos.filter((a) => a.diasRestantes >= 0)].sort((a, b) =>
    a.vencimiento.localeCompare(b.vencimiento),
  );

  const meses = new Map<string, typeof proximos>();
  for (const aviso of proximos) {
    const clave = aviso.vencimiento.slice(0, 7);
    const grupo = meses.get(clave) ?? [];
    grupo.push(aviso);
    meses.set(clave, grupo);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plazos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {avisos.length === 0
            ? 'No hay ningún plazo abierto.'
            : `${String(avisos.length)} plazos abiertos en toda la organización.`}
        </p>
      </div>

      {avisos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <h2 className="text-sm font-semibold">Nada pendiente</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Los plazos aparecen aquí en cuanto se abre un expediente desde una plantilla de
            procedimiento, con su fundamento legal al lado de cada fecha.
          </p>
        </div>
      ) : null}

      {vencidos.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight text-status-red">
            <span aria-hidden="true">▲ </span>
            Vencidos
          </h2>
          <ul className="space-y-2">
            {vencidos.map((aviso) => {
              const plazo = porId.get(aviso.plazoId);
              if (!plazo) return null;
              return (
                <FilaPlazo
                  key={aviso.plazoId}
                  orgSlug={orgSlug}
                  aviso={aviso}
                  expediente={plazo.expediente}
                  computo={describirComputo(plazo.cantidad, plazo.computo)}
                />
              );
            })}
          </ul>
        </section>
      ) : null}

      {[...meses.entries()].map(([clave, grupo]) => (
        <section key={clave} className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight first-letter:uppercase">
            {tituloDeMes(grupo[0]?.vencimiento ?? `${clave}-01`)}
          </h2>
          <ul className="space-y-2">
            {grupo.map((aviso) => {
              const plazo = porId.get(aviso.plazoId);
              if (!plazo) return null;
              return (
                <FilaPlazo
                  key={aviso.plazoId}
                  orgSlug={orgSlug}
                  aviso={aviso}
                  expediente={plazo.expediente}
                  computo={describirComputo(plazo.cantidad, plazo.computo)}
                />
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

function FilaPlazo({
  orgSlug,
  aviso,
  expediente,
  computo,
}: {
  orgSlug: string;
  aviso: ReturnType<typeof avisosDePlazos>[number];
  expediente: { id: string; referencia: string; titulo: string };
  computo: string;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 border-b border-border pb-2 last:border-0">
      <div className="min-w-0">
        <EtiquetaPlazo aviso={aviso} />
        <p className="mt-0.5 text-xs text-muted-foreground">
          <Link
            href={`/${orgSlug}/expedientes/${expediente.id}`}
            className="font-medium underline-offset-4 hover:underline"
          >
            {expediente.referencia}
          </Link>{' '}
          — {expediente.titulo}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {computo} · {aviso.detalle}
        </p>
      </div>
      <p className="text-xs whitespace-nowrap text-muted-foreground" data-numeric>
        {formatearEs(aviso.vencimiento)}
      </p>
    </li>
  );
}
