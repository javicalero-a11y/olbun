import type { Metadata } from 'next';

import { crear } from './acciones';
import { CLASE_NIVEL, FormularioRiesgo } from '@/components/features/riesgos/formulario-riesgo';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import {
  ETIQUETA_NIVEL,
  nivelVigente,
  valorar,
  valorarResidual,
} from '@/lib/domain/riesgos/matriz';
import { requirePermission } from '@/lib/auth/guardias';
import { tenantClient } from '@/lib/db/tenant';
import type { Escala } from '@/lib/domain/riesgos/matriz';

export const metadata: Metadata = { title: 'Riesgos' };

const ETIQUETA_CATEGORIA: Record<string, string> = {
  CONTRACTUAL: 'Contractual',
  LABORAL: 'Laboral',
  PREVENCION: 'Prevención',
  ECONOMICO: 'Económico',
  OPERATIVO: 'Operativo',
  REPUTACIONAL: 'Reputacional',
  CUMPLIMIENTO: 'Cumplimiento',
  PROTECCION_DATOS: 'Protección de datos',
};

/**
 * The risk register.
 *
 * Ordered by the score that is actually current — the residual where somebody
 * has assessed one, the inherent where nobody has. Sorting on the inherent
 * would bury the risks already worked on under ones nobody has touched;
 * defaulting an unassessed residual to the inherent would quietly claim every
 * risk had been treated.
 */
export default async function RiesgosPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const contexto = await requirePermission(orgSlug, 'riesgo:view');
  const db = tenantClient(contexto.organisation.id);

  const [riesgos, contratos] = await Promise.all([
    db.riesgo.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        referencia: true,
        categoria: true,
        causa: true,
        evento: true,
        consecuencia: true,
        probabilidadInherente: true,
        impactoInherente: true,
        probabilidadResidual: true,
        impactoResidual: true,
        respuesta: true,
        estado: true,
        contrato: { select: { numeroExpediente: true } },
      },
      take: 200,
    }),
    db.contrato.findMany({
      where: { deletedAt: null },
      select: { id: true, numeroExpediente: true, objeto: true },
      orderBy: { numeroExpediente: 'asc' },
    }),
  ]);

  const filas = riesgos
    .map((riesgo) => {
      const inherente = valorar(
        riesgo.probabilidadInherente as Escala,
        riesgo.impactoInherente as Escala,
      );
      const residual = valorarResidual(riesgo.probabilidadResidual, riesgo.impactoResidual);

      return { ...riesgo, inherente, residual, vigente: nivelVigente(inherente, residual) };
    })
    .sort((a, b) => b.vigente.puntuacion - a.vigente.puntuacion);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Riesgos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Lo que todavía no ha pasado. Cada riesgo se escribe como causa, evento y consecuencia,
          porque «riesgo de penalidad» no es algo sobre lo que nadie pueda actuar.
        </p>
      </div>

      <FormularioRiesgo
        accion={crear.bind(null, orgSlug)}
        contratos={contratos.map((contrato) => ({
          id: contrato.id,
          etiqueta: `${contrato.numeroExpediente} — ${contrato.objeto}`,
        }))}
      />

      <Tabla
        titulo="Registro de riesgos, ordenado por el nivel que está vigente hoy"
        anchoMinimo="880px"
        filas={filas}
        claveDeFila={(riesgo) => riesgo.id}
        vacio={
          <EstadoVacio
            titulo="El registro está vacío"
            explicacion="Un registro de riesgos es donde se anota lo que puede salir mal antes de que salga mal: quedarse corto de plantilla, perder una prórroga, que caduque una certificación. Se revisa periódicamente, y esa revisión es lo que pide una auditoría."
          />
        }
        columnas={[
          {
            clave: 'referencia',
            encabezado: 'Riesgo',
            esCabeceraDeFila: true,
            celda: (riesgo) => (
              <>
                <span className="text-sm font-medium">{riesgo.evento}</span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {riesgo.referencia} · porque {riesgo.causa}
                </p>
              </>
            ),
          },
          {
            clave: 'consecuencia',
            encabezado: 'Consecuencia',
            clase: 'text-xs text-muted-foreground max-w-[22rem]',
            celda: (riesgo) => riesgo.consecuencia,
          },
          {
            clave: 'categoria',
            encabezado: 'Categoría',
            clase: 'text-xs',
            celda: (riesgo) => ETIQUETA_CATEGORIA[riesgo.categoria] ?? riesgo.categoria,
          },
          {
            clave: 'nivel',
            encabezado: 'Nivel',
            celda: (riesgo) => (
              <div>
                <span className={`text-xs ${CLASE_NIVEL[riesgo.vigente.nivel] ?? ''}`}>
                  {ETIQUETA_NIVEL[riesgo.vigente.nivel]} · {String(riesgo.vigente.puntuacion)}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {riesgo.residual
                    ? `Residual, de ${String(riesgo.inherente.puntuacion)} inherente`
                    : 'Sin valorar el residual'}
                </p>
              </div>
            ),
          },
          {
            clave: 'contrato',
            encabezado: 'Contrato',
            clase: 'text-xs text-muted-foreground',
            celda: (riesgo) => riesgo.contrato?.numeroExpediente ?? 'Organización',
          },
        ]}
      />
    </div>
  );
}
