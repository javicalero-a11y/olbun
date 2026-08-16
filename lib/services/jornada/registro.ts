import 'server-only';

import { calcularHoras, evaluarBolsa } from '@/lib/domain/jornada/horas';
import { HASH_INICIAL, sellar, verificarCadena } from '@/lib/domain/jornada/integridad';
import { ErrorDeCampo } from '@/lib/services/error-de-campo';
import type { Bolsa, HoraDelDia, Pausa } from '@/lib/domain/jornada/horas';
import type {
  EslabonVerificable,
  ResultadoVerificacion,
} from '@/lib/domain/jornada/integridad';
import type { OrigenRegistroJornada, Prisma } from '@prisma/client';
import type { FechaCivil } from '@/lib/domain/fecha';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * Writing and proving the working-time register (SPEC §4.9.5, M13).
 *
 * Every record is appended to the end of that employee's chain, sealed against
 * the one before it. A correction is a new record pointing at the one it
 * corrects; nothing is ever edited.
 *
 * Three things hold that up, and they are worth knowing apart:
 *
 *   1. A trigger refuses every UPDATE on the table, for everyone.
 *   2. The application role has had UPDATE and DELETE revoked, so this code
 *      could not rewrite a row even with a bug in it. The revoke is explicit
 *      because an early migration grants both by default on every future
 *      table — granting less does not take away what was already given.
 *   3. DELETE is still possible for the schema owner, on purpose: a tenant has
 *      to be able to leave, and an erasure request has to be answerable. A row
 *      removed that way breaks the chain, and `verificarJornadaDe` says where.
 *
 * That is tamper-evidence, not tamper-proofing. Anchoring the chain outside
 * the system is what would give the second, and it belongs to a later
 * milestone.
 *
 * The chain is per employee rather than per organisation. Two people clocking
 * out at the same moment would otherwise contend for the same tail, and the
 * evidential question an inspector asks is always about one worker's record.
 */

const aDate = (fecha: FechaCivil): Date => new Date(`${fecha}T00:00:00.000Z`);
const aFecha = (fecha: Date): FechaCivil => fecha.toISOString().slice(0, 10);

export interface DatosRegistro {
  empleadoId: string;
  fecha: FechaCivil;
  horaEntrada: HoraDelDia;
  horaSalida: HoraDelDia;
  pausas: readonly Pausa[];
  horasOrdinariasPactadas: number;
  esFestivo: boolean;
  origen: OrigenRegistroJornada;
  /** Set when this record corrects an earlier one. */
  corrigeARegistroId?: string | undefined;
  actorId: string;
}

/** Reads the tail of an employee's chain, which the next record seals against. */
async function ultimoHash(db: TenantTransactionClient, empleadoId: string): Promise<string> {
  const ultimo = await db.registroJornada.findFirst({
    where: { empleadoId },
    select: { hashIntegridad: true },
    orderBy: { createdAt: 'desc' },
  });

  return ultimo?.hashIntegridad ?? HASH_INICIAL;
}

export async function registrarJornada(
  db: TenantTransactionClient,
  organisationId: string,
  datos: DatosRegistro,
) {
  const empleado = await db.empleado.findFirst({
    where: { id: datos.empleadoId, deletedAt: null },
    select: { id: true },
  });

  if (!empleado) throw new ErrorDeCampo('empleadoId', 'Ese empleado no existe.');

  if (datos.corrigeARegistroId) {
    const corregido = await db.registroJornada.findFirst({
      where: { id: datos.corrigeARegistroId, empleadoId: datos.empleadoId },
      select: { id: true },
    });

    // Corregir el registro de otra persona no es una corrección, es una
    // invención: la cadena que se sella es la de este empleado.
    if (!corregido) {
      throw new ErrorDeCampo(
        'corrigeARegistroId',
        'El registro que se quiere corregir no existe o es de otra persona.',
      );
    }
  }

  const horas = calcularHoras({
    entrada: datos.horaEntrada,
    salida: datos.horaSalida,
    pausas: datos.pausas,
    horasOrdinariasPactadas: datos.horasOrdinariasPactadas,
    esFestivo: datos.esFestivo,
  });

  const hashAnterior = await ultimoHash(db, datos.empleadoId);
  const creadoEn = new Date();

  const sellable = {
    empleadoId: datos.empleadoId,
    fecha: datos.fecha,
    horaEntrada: datos.horaEntrada,
    horaSalida: datos.horaSalida,
    pausas: datos.pausas.map((pausa) => ({ desde: pausa.desde, hasta: pausa.hasta })),
    horasOrdinarias: horas.ordinarias,
    horasExtra: horas.extra,
    horasNocturnas: horas.nocturnas,
    horasFestivas: horas.festivas,
    origen: datos.origen,
    creadoEn: creadoEn.toISOString(),
    corrigeARegistroId: datos.corrigeARegistroId ?? null,
  };

  const hashIntegridad = sellar(sellable, hashAnterior);

  const registro = await db.registroJornada.create({
    data: {
      organisationId,
      empleadoId: datos.empleadoId,
      fecha: aDate(datos.fecha),
      horaEntrada: datos.horaEntrada,
      horaSalida: datos.horaSalida,
      pausas: sellable.pausas as unknown as Prisma.InputJsonValue,
      horasOrdinarias: horas.ordinarias,
      horasExtra: horas.extra,
      horasNocturnas: horas.nocturnas,
      horasFestivas: horas.festivas,
      origen: datos.origen,
      hashIntegridad,
      hashAnterior,
      corrigeARegistroId: datos.corrigeARegistroId ?? null,
      // `createdAt` sella el registro, así que se fija explícitamente en vez
      // de dejarlo al reloj de la base de datos: el sello y la fila tienen que
      // decir el mismo instante.
      createdAt: creadoEn,
      createdById: datos.actorId,
    },
    select: { id: true, hashIntegridad: true, horasExtra: true, fecha: true },
  });

  return {
    ...registro,
    horas,
  };
}

interface FilaCadena {
  id: string;
  empleadoId: string;
  fecha: Date;
  horaEntrada: string | null;
  horaSalida: string | null;
  pausas: Prisma.JsonValue;
  horasOrdinarias: Prisma.Decimal;
  horasExtra: Prisma.Decimal;
  horasNocturnas: Prisma.Decimal;
  horasFestivas: Prisma.Decimal;
  origen: OrigenRegistroJornada;
  createdAt: Date;
  corrigeARegistroId: string | null;
  hashIntegridad: string;
  hashAnterior: string;
}

function aEslabon(fila: FilaCadena): EslabonVerificable {
  const pausas = Array.isArray(fila.pausas)
    ? (fila.pausas as { desde: string; hasta: string }[])
    : [];

  return {
    id: fila.id,
    empleadoId: fila.empleadoId,
    fecha: aFecha(fila.fecha),
    horaEntrada: fila.horaEntrada,
    horaSalida: fila.horaSalida,
    pausas,
    horasOrdinarias: Number(fila.horasOrdinarias),
    horasExtra: Number(fila.horasExtra),
    horasNocturnas: Number(fila.horasNocturnas),
    horasFestivas: Number(fila.horasFestivas),
    origen: fila.origen,
    creadoEn: fila.createdAt.toISOString(),
    corrigeARegistroId: fila.corrigeARegistroId,
    hashIntegridad: fila.hashIntegridad,
    hashAnterior: fila.hashAnterior,
  };
}

const SELECCION_CADENA = {
  id: true,
  empleadoId: true,
  fecha: true,
  horaEntrada: true,
  horaSalida: true,
  pausas: true,
  horasOrdinarias: true,
  horasExtra: true,
  horasNocturnas: true,
  horasFestivas: true,
  origen: true,
  createdAt: true,
  corrigeARegistroId: true,
  hashIntegridad: true,
  hashAnterior: true,
} satisfies Prisma.RegistroJornadaSelect;

/**
 * Re-checks one employee's chain from the beginning.
 *
 * This is the answer to "prove the record was not altered". It is deliberately
 * something anybody can ask for at any time rather than a background job:
 * a verification nobody ran is not evidence, and one that runs on a schedule
 * is a report that the last run was fine.
 */
export async function verificarJornadaDe(
  db: TenantTransactionClient,
  empleadoId: string,
): Promise<ResultadoVerificacion> {
  const filas = await db.registroJornada.findMany({
    where: { empleadoId },
    select: SELECCION_CADENA,
    orderBy: { createdAt: 'asc' },
  });

  return verificarCadena(filas.map(aEslabon));
}

export interface ResumenAnual {
  bolsa: Bolsa;
  horasExtraDelAnio: number;
  registros: number;
}

/** The overtime bag for one worker in one calendar year (art. 35.2 ET). */
export async function bolsaAnual(
  db: TenantTransactionClient,
  empleadoId: string,
  anio: number,
): Promise<ResumenAnual> {
  const desde = new Date(Date.UTC(anio, 0, 1));
  const hasta = new Date(Date.UTC(anio + 1, 0, 1));

  const agregado = await db.registroJornada.aggregate({
    where: { empleadoId, fecha: { gte: desde, lt: hasta } },
    _sum: { horasExtra: true },
    _count: true,
  });

  const horasExtra = Number(agregado._sum.horasExtra ?? 0);

  return {
    bolsa: evaluarBolsa(horasExtra),
    horasExtraDelAnio: horasExtra,
    registros: agregado._count,
  };
}

/**
 * Days with no record at all, which is the infringement itself.
 *
 * The ITSS does not only ask whether the hours are right; it asks whether the
 * record exists for every working day. A gap is the finding, so it is computed
 * over the days somebody was assigned rather than over the days they happened
 * to clock in.
 */
export async function diasSinRegistro(
  db: TenantTransactionClient,
  empleadoId: string,
  diasLaborables: readonly FechaCivil[],
): Promise<FechaCivil[]> {
  if (diasLaborables.length === 0) return [];

  const registros = await db.registroJornada.findMany({
    where: {
      empleadoId,
      fecha: {
        gte: aDate(diasLaborables[0] as FechaCivil),
        lte: aDate(diasLaborables[diasLaborables.length - 1] as FechaCivil),
      },
    },
    select: { fecha: true },
  });

  const conRegistro = new Set(registros.map((fila) => aFecha(fila.fecha)));

  return diasLaborables.filter((dia) => !conRegistro.has(dia));
}
