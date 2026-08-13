import 'server-only';

import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * The risk register and the incident log (SPEC §4.6, M10).
 *
 * Two records that look similar and answer opposite questions: an incidencia
 * is something that happened, a riesgo is something that has not. Keeping them
 * apart is what lets the register be reviewed on a cadence while the log stays
 * a chronological record nobody rewrites.
 *
 * Both can escalate into an expediente, and both can be born from a detection
 * a person confirmed — which is the link that makes the triage queue whole.
 */

/**
 * Next reference in a per-organisation, per-year series.
 *
 * Generalised from the expediente numbering: three series that number
 * themselves three slightly different ways is the kind of divergence nobody
 * notices until a customer asks why their incidents skip a number.
 */
export async function siguienteReferenciaDe(
  buscarUltima: (prefijo: string) => Promise<string | null>,
  prefijo: string,
  anio: number,
): Promise<string> {
  const completo = `${prefijo}-${String(anio)}-`;
  const ultima = await buscarUltima(completo);

  const siguiente = ultima ? Number(ultima.slice(completo.length)) + 1 : 1;

  return `${completo}${String(siguiente).padStart(4, '0')}`;
}

export interface CrearIncidenciaDatos {
  tipo: string;
  gravedad: string;
  fechaHecho: Date;
  descripcion: string;
  contratoId?: string | undefined;
  lugar?: string | undefined;
  medidasInmediatas?: string | undefined;
  esNotificableAAutoridad?: boolean | undefined;
  deteccionId?: string | undefined;
  creadoPorId: string;
}

export async function crearIncidencia(
  db: TenantTransactionClient,
  organisationId: string,
  datos: CrearIncidenciaDatos,
): Promise<{ id: string; referencia: string }> {
  const referencia = await siguienteReferenciaDe(
    async (prefijo) => {
      const ultima = await db.incidencia.findFirst({
        where: { referencia: { startsWith: prefijo } },
        select: { referencia: true },
        orderBy: { referencia: 'desc' },
      });
      return ultima?.referencia ?? null;
    },
    'INC',
    datos.fechaHecho.getUTCFullYear(),
  );

  return db.incidencia.create({
    data: {
      organisationId,
      referencia,
      tipo: datos.tipo as never,
      gravedad: datos.gravedad as never,
      fechaHecho: datos.fechaHecho,
      // Recorded now because "when were we told" is what a diligence argument
      // turns on, and reconstructing it later is guesswork.
      fechaComunicacion: new Date(),
      descripcion: datos.descripcion,
      contratoId: datos.contratoId ?? null,
      lugar: datos.lugar ?? null,
      medidasInmediatas: datos.medidasInmediatas ?? null,
      esNotificableAAutoridad: datos.esNotificableAAutoridad ?? false,
      deteccionId: datos.deteccionId ?? null,
      createdById: datos.creadoPorId,
    },
    select: { id: true, referencia: true },
  });
}

export interface CrearRiesgoDatos {
  categoria: string;
  causa: string;
  evento: string;
  consecuencia: string;
  probabilidadInherente: number;
  impactoInherente: number;
  respuesta?: string | undefined;
  controles?: string | undefined;
  contratoId?: string | undefined;
  proximaRevision?: Date | undefined;
  deteccionId?: string | undefined;
  creadoPorId: string;
}

export async function crearRiesgo(
  db: TenantTransactionClient,
  organisationId: string,
  datos: CrearRiesgoDatos,
): Promise<{ id: string; referencia: string }> {
  const referencia = await siguienteReferenciaDe(
    async (prefijo) => {
      const ultima = await db.riesgo.findFirst({
        where: { referencia: { startsWith: prefijo } },
        select: { referencia: true },
        orderBy: { referencia: 'desc' },
      });
      return ultima?.referencia ?? null;
    },
    'RSG',
    new Date().getUTCFullYear(),
  );

  return db.riesgo.create({
    data: {
      organisationId,
      referencia,
      categoria: datos.categoria as never,
      causa: datos.causa,
      evento: datos.evento,
      consecuencia: datos.consecuencia,
      probabilidadInherente: datos.probabilidadInherente,
      impactoInherente: datos.impactoInherente,
      respuesta: (datos.respuesta ?? 'MITIGAR') as never,
      controles: datos.controles ?? null,
      contratoId: datos.contratoId ?? null,
      proximaRevision: datos.proximaRevision ?? null,
      deteccionId: datos.deteccionId ?? null,
      createdById: datos.creadoPorId,
    },
    select: { id: true, referencia: true },
  });
}
