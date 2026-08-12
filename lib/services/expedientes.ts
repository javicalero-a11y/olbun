import 'server-only';

import { cargarCalendarios } from '@/lib/db/calendarios';
import { planificarPasos } from '@/lib/domain/expedientes/planificacion';
import type { FechaCivil } from '@/lib/domain/fecha';
import type { TenantClient } from '@/lib/db/tenant';

/**
 * Opening an expediente instantiates its procedure template: the whole
 * timeline of hitos and plazos exists from the moment it is created, rather
 * than being typed in by hand while the clock is already running.
 *
 * The dating rules live in `lib/domain/expedientes/planificacion`, which is
 * pure and tested; this module only persists what it decides. Every deadline
 * is stored with the days it skipped, its legal basis, and whether the
 * calendars behind it were complete. Nothing is marked confirmed — that
 * requires a person (SPEC §2, principle 2).
 */

export function aFechaCivil(valor: Date): FechaCivil {
  return valor.toISOString().slice(0, 10);
}

export function aDate(valor: FechaCivil): Date {
  return new Date(`${valor}T00:00:00.000Z`);
}

/** Next reference in the EXP-YYYY-NNNN series, per organisation and year. */
export async function siguienteReferencia(db: TenantClient, anio: number): Promise<string> {
  const prefijo = `EXP-${String(anio)}-`;

  const ultimo = await db.expediente.findFirst({
    where: { referencia: { startsWith: prefijo } },
    select: { referencia: true },
    orderBy: { referencia: 'desc' },
  });

  const siguiente = ultimo ? Number(ultimo.referencia.slice(prefijo.length)) + 1 : 1;

  return `${prefijo}${String(siguiente).padStart(4, '0')}`;
}

export interface AbrirExpedienteDatos {
  titulo: string;
  tipo: string;
  jurisdiccion: string;
  contratoId?: string | undefined;
  plantillaId?: string | undefined;
  /** The event that starts the clock — usually when a notification took effect. */
  fechaApertura: FechaCivil;
  organoCompetente?: string | undefined;
  parteContraria?: string | undefined;
  cuantia?: number | undefined;
  resumen?: string | undefined;
  creadoPorId: string;
}

export interface AbrirExpedienteResultado {
  expedienteId: string;
  referencia: string;
  hitosCreados: number;
  plazosCreados: number;
  /** True when any deadline rests on an unverified or missing calendar. */
  hayPlazosIncompletos: boolean;
}

export async function abrirExpediente(
  db: TenantClient,
  organisationId: string,
  datos: AbrirExpedienteDatos,
): Promise<AbrirExpedienteResultado> {
  const anio = Number(datos.fechaApertura.slice(0, 4));
  const referencia = await siguienteReferencia(db, anio);

  // The municipality of the contracting authority decides which local holiday
  // calendar governs deadlines in its procedures.
  const contrato = datos.contratoId
    ? await db.contrato.findFirst({
        where: { id: datos.contratoId, deletedAt: null },
        select: {
          id: true,
          poderAdjudicador: {
            select: { comunidadAutonoma: true, municipioIne: true },
          },
        },
      })
    : null;

  const calendario = await cargarCalendarios({
    comunidadAutonoma: contrato?.poderAdjudicador.comunidadAutonoma,
    municipioIne: contrato?.poderAdjudicador.municipioIne,
  });

  const plantilla = datos.plantillaId
    ? await db.plantillaProcedimiento.findFirst({
        where: { id: datos.plantillaId, deletedAt: null },
        include: { hitos: { orderBy: { orden: 'asc' } } },
      })
    : null;

  const expediente = await db.expediente.create({
    data: {
      organisationId,
      referencia,
      titulo: datos.titulo,
      resumen: datos.resumen ?? null,
      tipo: datos.tipo as never,
      jurisdiccion: datos.jurisdiccion as never,
      estado: 'ABIERTO',
      contratoId: contrato?.id ?? null,
      plantillaId: plantilla?.id ?? null,
      organoCompetente: datos.organoCompetente ?? null,
      parteContraria: datos.parteContraria ?? null,
      cuantia: datos.cuantia ?? null,
      fechaApertura: aDate(datos.fechaApertura),
      createdById: datos.creadoPorId,
    },
    select: { id: true, referencia: true },
  });

  let plazosCreados = 0;
  let hayPlazosIncompletos = false;

  const pasos = plantilla?.hitos ?? [];
  const plan = planificarPasos(pasos, datos.fechaApertura, calendario);
  const porOrden = new Map(plan.map((paso) => [paso.orden, paso]));

  for (const paso of pasos) {
    const planificado = porOrden.get(paso.orden);

    const hito = await db.hito.create({
      data: {
        organisationId,
        expedienteId: expediente.id,
        orden: paso.orden,
        nombre: paso.nombre,
        tipo: paso.tipo,
        descripcion: paso.descripcion,
        estado: 'PENDIENTE',
        fechaPrevista: planificado?.fechaPrevista ? aDate(planificado.fechaPrevista) : null,
      },
      select: { id: true },
    });

    const plazo = planificado?.plazo;
    if (!plazo) continue;

    if (!plazo.completo) hayPlazosIncompletos = true;

    await db.plazo.create({
      data: {
        organisationId,
        expedienteId: expediente.id,
        hitoId: hito.id,
        descripcion: paso.nombre,
        fundamento: plazo.fundamento,
        fechaInicio: aDate(planificado.inicio),
        cantidad: plazo.cantidad,
        computo: plazo.computo,
        fechaVencimientoCalculada: aDate(plazo.resultado.vencimiento),
        calculoCompleto: plazo.completo,
        advertencias: plazo.advertencias,
        diasExcluidos: plazo.resultado.diasExcluidos,
        esPreclusivo: plazo.esPreclusivo,
        estado: 'VIGENTE',
      },
    });

    plazosCreados += 1;
  }

  return {
    expedienteId: expediente.id,
    referencia: expediente.referencia,
    hitosCreados: plantilla?.hitos.length ?? 0,
    plazosCreados,
    hayPlazosIncompletos,
  };
}
