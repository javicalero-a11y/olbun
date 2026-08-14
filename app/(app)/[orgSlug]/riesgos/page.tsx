import Link from 'next/link';
import type { Metadata } from 'next';

import { crear } from './acciones';
import { can } from '@/lib/auth/can';
import { requirePermission } from '@/lib/auth/guardias';
import { isScopedRole } from '@/lib/auth/permissions';
import { FormularioRiesgo, CLASE_NIVEL } from '@/components/features/riesgos/formulario-riesgo';
import { MatrizRiesgos } from '@/components/features/riesgos/matriz-riesgos';
import { EstadoVacio, Tabla } from '@/components/ui/tabla';
import { tenantClient } from '@/lib/db/tenant';
import { hoyEn, type FechaCivil } from '@/lib/domain/fecha';
import { situacionRevision } from '@/lib/domain/riesgos/ciclo';
import {
  nivelVigente,
  nombreDeNivel,
  valorar,
  valorarResidual,
  type Escala,
} from '@/lib/domain/riesgos/matriz';
import { cargarBandasRiesgo } from '@/lib/services/riesgos';

export const metadata: Metadata = { title: 'Riesgos' };

function escalaDe(valor: string | undefined): Escala | null {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 1 && numero <= 5 ? (numero as Escala) : null;
}

function fechaCivil(fecha: Date | null): FechaCivil | null {
  return fecha ? fecha.toISOString().slice(0, 10) : null;
}

export default async function RiesgosPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ probabilidad?: string; impacto?: string }>;
}) {
  const { orgSlug } = await params;
  const filtro = await searchParams;
  const probabilidad = escalaDe(filtro.probabilidad);
  const impacto = escalaDe(filtro.impacto);
  const contexto = await requirePermission(orgSlug, 'riesgo:view');
  const db = tenantClient(contexto.organisation.id);
  const conAlcance = isScopedRole(contexto.actor.role);
  const alcance = conAlcance ? { contratoId: { in: [...contexto.actor.contratoIds] } } : {};
  const celda =
    probabilidad && impacto
      ? {
          OR: [
            { probabilidadResidual: probabilidad, impactoResidual: impacto },
            {
              probabilidadResidual: null,
              impactoResidual: null,
              probabilidadInherente: probabilidad,
              impactoInherente: impacto,
            },
          ],
        }
      : {};

  const [riesgos, matrizAgrupada, contratos, categorias, membresias, bandas] =
    await Promise.all([
      db.riesgo.findMany({
        where: { deletedAt: null, ...alcance, ...celda },
        select: {
          id: true,
          referencia: true,
          categoria: { select: { id: true, nombre: true, color: true } },
          causa: true,
          evento: true,
          consecuencia: true,
          probabilidadInherente: true,
          impactoInherente: true,
          probabilidadResidual: true,
          impactoResidual: true,
          respuesta: true,
          estado: true,
          proximaRevision: true,
          responsableId: true,
          contrato: { select: { numeroExpediente: true } },
        },
        take: 200,
      }),
      db.riesgo.groupBy({
        by: [
          'probabilidadInherente',
          'impactoInherente',
          'probabilidadResidual',
          'impactoResidual',
        ],
        where: { deletedAt: null, ...alcance },
        _count: { _all: true },
      }),
      db.contrato.findMany({
        where: {
          deletedAt: null,
          ...(conAlcance ? { id: { in: [...contexto.actor.contratoIds] } } : {}),
        },
        select: { id: true, numeroExpediente: true, objeto: true },
        orderBy: { numeroExpediente: 'asc' },
      }),
      db.categoriaRiesgo.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, nombre: true },
        orderBy: { orden: 'asc' },
      }),
      db.membership.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { user: { select: { id: true, name: true } } },
        orderBy: { user: { name: 'asc' } },
      }),
      cargarBandasRiesgo(db),
    ]);

  const nombres = new Map(membresias.map(({ user }) => [user.id, user.name]));
  const filas = riesgos
    .map((riesgo) => {
      const inherente = valorar(
        riesgo.probabilidadInherente as Escala,
        riesgo.impactoInherente as Escala,
        bandas,
      );
      const residual = valorarResidual(
        riesgo.probabilidadResidual,
        riesgo.impactoResidual,
        bandas,
      );
      return { ...riesgo, inherente, residual, vigente: nivelVigente(inherente, residual) };
    })
    .sort((a, b) => b.vigente.puntuacion - a.vigente.puntuacion);
  const matriz = matrizAgrupada.map((grupo) => ({
    probabilidad: (grupo.probabilidadResidual ?? grupo.probabilidadInherente) as Escala,
    impacto: (grupo.impactoResidual ?? grupo.impactoInherente) as Escala,
    cantidad: grupo._count._all,
  }));
  const puedeGestionar =
    can(contexto.actor, 'riesgo:manage') &&
    categorias.length > 0 &&
    (!conAlcance || contratos.length > 0);
  const hoy = hoyEn(contexto.organisation.timezone);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Riesgos</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Lo que todavía no ha pasado, con controles, acciones y una revisión que deja
          histórico.
        </p>
      </div>

      <MatrizRiesgos riesgos={matriz} bandas={bandas} basePath={`/${orgSlug}/riesgos`} />

      {puedeGestionar ? (
        <FormularioRiesgo
          accion={crear.bind(null, orgSlug)}
          contratos={contratos.map((contrato) => ({
            id: contrato.id,
            etiqueta: `${contrato.numeroExpediente} — ${contrato.objeto}`,
          }))}
          categorias={categorias}
          responsables={membresias.map(({ user }) => ({ id: user.id, nombre: user.name }))}
          bandas={bandas}
        />
      ) : null}

      {probabilidad && impacto ? (
        <p
          role="status"
          className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm"
        >
          Filtro activo: probabilidad {probabilidad}, impacto {impacto}.{' '}
          <Link
            href={`/${orgSlug}/riesgos`}
            className="font-medium text-primary hover:underline"
          >
            Ver todos
          </Link>
        </p>
      ) : null}

      <Tabla
        titulo="Registro de riesgos, ordenado por el nivel vigente"
        anchoMinimo="980px"
        filas={filas}
        claveDeFila={(riesgo) => riesgo.id}
        vacio={
          <EstadoVacio
            titulo="El registro está vacío"
            explicacion="Anota lo que puede salir mal antes de que salga mal; cada revisión demuestra qué se comprobó y cuándo."
          />
        }
        columnas={[
          {
            clave: 'referencia',
            encabezado: 'Riesgo',
            esCabeceraDeFila: true,
            celda: (riesgo) => (
              <>
                <Link
                  href={`/${orgSlug}/riesgos/${riesgo.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {riesgo.evento}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {riesgo.referencia} · porque {riesgo.causa}
                </p>
              </>
            ),
          },
          {
            clave: 'consecuencia',
            encabezado: 'Consecuencia',
            clase: 'text-xs text-muted-foreground max-w-[20rem]',
            celda: (riesgo) => riesgo.consecuencia,
          },
          {
            clave: 'categoria',
            encabezado: 'Categoría',
            clase: 'text-xs',
            celda: (riesgo) => riesgo.categoria?.nombre ?? 'Categoría heredada',
          },
          {
            clave: 'nivel',
            encabezado: 'Nivel',
            celda: (riesgo) => (
              <div>
                <span className={`text-xs ${CLASE_NIVEL[riesgo.vigente.nivel] ?? ''}`}>
                  {nombreDeNivel(riesgo.vigente.nivel, bandas)} · {riesgo.vigente.puntuacion}
                </span>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {riesgo.residual
                    ? `Residual, de ${riesgo.inherente.puntuacion} inherente`
                    : 'Sin valorar el residual'}
                </p>
              </div>
            ),
          },
          {
            clave: 'revision',
            encabezado: 'Revisión',
            clase: 'text-xs',
            celda: (riesgo) => {
              const situacion = situacionRevision(fechaCivil(riesgo.proximaRevision), hoy);
              return (
                <div>
                  <span
                    className={situacion === 'VENCIDA' ? 'font-semibold text-destructive' : ''}
                  >
                    {situacion === 'VENCIDA'
                      ? 'Vencida'
                      : situacion === 'VENCE_HOY'
                        ? 'Vence hoy'
                        : situacion === 'SIN_FECHA'
                          ? 'Sin programar'
                          : fechaCivil(riesgo.proximaRevision)}
                  </span>
                  <p className="text-muted-foreground">
                    {riesgo.responsableId
                      ? (nombres.get(riesgo.responsableId) ?? 'Responsable inactivo')
                      : 'Sin responsable'}
                  </p>
                </div>
              );
            },
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
