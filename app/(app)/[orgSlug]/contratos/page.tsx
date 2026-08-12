import type { Metadata } from 'next';
import Link from 'next/link';

import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import { avisoMasUrgente } from '@/lib/domain/contratos/avisos';
import {
  ETIQUETA_ESTADO_CONTRATO,
  ETIQUETA_TIPO_CONTRATO,
  formatearEuros,
} from '@/lib/domain/contratos/etiquetas';
import { formatearEs, hoyEn, type FechaCivil } from '@/lib/domain/fecha';
import { EtiquetaAviso } from '@/components/features/contratos/aviso';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';

export const metadata: Metadata = { title: 'Contratos' };

/** Prisma returns @db.Date as a UTC-midnight Date; back to a civil date. */
function aCivil(valor: Date | null): FechaCivil | undefined {
  return valor ? valor.toISOString().slice(0, 10) : undefined;
}

export default async function ContratosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'contrato:view');
  const db = tenantClient(contexto.organisation.id);

  const contratos = await db.contrato.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      numeroExpediente: true,
      objeto: true,
      tipo: true,
      estado: true,
      fechaFinPrevista: true,
      preavisoProrrogaDias: true,
      importeAdjudicacion: true,
      poderAdjudicador: { select: { nombre: true } },
    },
    orderBy: [{ fechaFinPrevista: 'asc' }, { numeroExpediente: 'asc' }],
  });

  const hoy = hoyEn(contexto.organisation.timezone);
  const puedeCrear = can(contexto.actor, 'contrato:create');

  // Ordered by urgency rather than by end date: what a responsable opens this
  // screen for is "what is about to bite me", and a finished contract with no
  // warning does not belong above one that loses its extension in a fortnight.
  const filas = contratos
    .map((contrato) => {
      const fin = aCivil(contrato.fechaFinPrevista);
      return {
        contrato,
        fin,
        aviso: avisoMasUrgente(
          {
            fechaFinPrevista: fin,
            preavisoProrrogaDias: contrato.preavisoProrrogaDias ?? undefined,
            estado: contrato.estado,
          },
          hoy,
        ),
      };
    })
    .sort((a, b) => {
      // Anything with a live warning comes first, soonest at the top.
      if (a.aviso && b.aviso) return a.aviso.diasRestantes - b.aviso.diasRestantes;
      if (a.aviso) return -1;
      if (b.aviso) return 1;
      return (a.fin ?? '9999').localeCompare(b.fin ?? '9999');
    });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contratos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {contratos.length === 0
              ? 'Todavía no hay ninguno.'
              : contratos.length === 1
                ? 'Un contrato.'
                : `${String(contratos.length)} contratos.`}
          </p>
        </div>

        {puedeCrear ? (
          <Link href={`/${orgSlug}/contratos/nuevo`} className="boton-primario">
            Nuevo contrato
          </Link>
        ) : null}
      </div>

      <Tabla
        titulo="Contratos de la organización, ordenados por urgencia del aviso más próximo"
        filas={filas}
        claveDeFila={({ contrato }) => contrato.id}
        vacio={
          <EstadoVacio
            titulo="Aquí vivirán tus contratos públicos"
            explicacion="Cada contrato reúne su órgano de contratación, sus fechas y sus importes, y es de donde cuelgan después los expedientes, los plazos y las incidencias. Registrar las fechas de fin y el preaviso de prórroga es lo que permite avisarte antes de perder una renovación."
            accion={
              puedeCrear ? (
                <Link
                  href={`/${orgSlug}/contratos/nuevo`}
                  className="text-sm font-medium text-foreground underline underline-offset-4"
                >
                  Registrar el primero
                </Link>
              ) : null
            }
          />
        }
        columnas={[
          {
            clave: 'expediente',
            encabezado: 'Expediente',
            esCabeceraDeFila: true,
            celda: ({ contrato, aviso }) => (
              <>
                <Link
                  href={`/${orgSlug}/contratos/${contrato.id}`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  {contrato.numeroExpediente}
                </Link>
                <p className="mt-0.5 max-w-md text-xs text-muted-foreground">
                  {contrato.objeto}
                </p>
                {aviso ? (
                  <p className="mt-1">
                    <EtiquetaAviso aviso={aviso} />
                  </p>
                ) : null}
              </>
            ),
          },
          {
            clave: 'organo',
            encabezado: 'Órgano',
            clase: 'text-xs text-muted-foreground',
            celda: ({ contrato }) => contrato.poderAdjudicador.nombre,
          },
          {
            clave: 'estado',
            encabezado: 'Estado',
            celda: ({ contrato }) => {
              const estado = ETIQUETA_ESTADO_CONTRATO[contrato.estado];
              return (
                <>
                  <span className={`text-xs font-medium ${estado.clase}`}>{estado.texto}</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {ETIQUETA_TIPO_CONTRATO[contrato.tipo]}
                  </p>
                </>
              );
            },
          },
          {
            clave: 'fin',
            encabezado: 'Fin',
            numerica: true,
            clase: 'text-xs',
            celda: ({ fin }) => (fin ? formatearEs(fin) : '—'),
          },
          {
            clave: 'importe',
            encabezado: 'Importe',
            numerica: true,
            clase: 'text-xs',
            celda: ({ contrato }) =>
              formatearEuros(
                contrato.importeAdjudicacion ? Number(contrato.importeAdjudicacion) : null,
              ),
          },
        ]}
      />
    </div>
  );
}
