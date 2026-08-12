/* eslint-disable no-console -- CLI helper, not application code. */
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import { planificarPasos } from '../lib/domain/expedientes/planificacion';
import type { CalendarioAplicable } from '../lib/domain/plazos/calendario';
import { sumarDias, type FechaCivil } from '../lib/domain/fecha';

/**
 * Opens a demo expediente against the seeded data, exercising the real
 * deadline engine rather than inventing dates.
 *
 * Deliberately dated so that one deadline is imminent and preclusive: a demo
 * where nothing is about to expire demonstrates nothing.
 */
const prisma = new PrismaClient({
  datasourceUrl: process.env['DIRECT_DATABASE_URL'] ?? process.env['DATABASE_URL'],
});

function hoyCivil(): FechaCivil {
  return new Date().toISOString().slice(0, 10);
}

function aDate(valor: FechaCivil): Date {
  return new Date(`${valor}T00:00:00.000Z`);
}

async function calendariosDe(
  comunidad: string | null,
  municipioIne: string | null,
): Promise<CalendarioAplicable> {
  const codigos: Record<string, string> = { Andalucía: 'AN' };
  const codigoCcaa = comunidad ? codigos[comunidad] : undefined;

  const calendarios = await prisma.calendario.findMany({
    where: {
      OR: [
        { ambito: 'NACIONAL' },
        ...(codigoCcaa ? [{ ambito: 'AUTONOMICO' as const, codigo: codigoCcaa }] : []),
        ...(municipioIne ? [{ ambito: 'LOCAL' as const, codigo: municipioIne }] : []),
      ],
    },
    include: { festivos: true },
  });

  const capa = (ambito: 'NACIONAL' | 'AUTONOMICO' | 'LOCAL') => {
    const propios = calendarios.filter((c) => c.ambito === ambito);
    if (propios.length === 0) return undefined;
    return {
      aniosCubiertos: propios.filter((c) => c.verificadoEn !== null).map((c) => c.anio),
      festivos: propios.flatMap((c) =>
        c.festivos.map((f) => ({
          fecha: f.fecha.toISOString().slice(0, 10),
          nombre: f.nombre,
        })),
      ),
    };
  };

  const autonomico = capa('AUTONOMICO');
  const local = capa('LOCAL');

  return {
    nacional: capa('NACIONAL') ?? { aniosCubiertos: [], festivos: [] },
    ...(autonomico ? { autonomico } : {}),
    ...(local ? { local } : {}),
  };
}

async function main(): Promise<void> {
  const org = await prisma.organisation.findUniqueOrThrow({
    where: { slug: 'servicios-guadaira' },
  });

  const contrato = await prisma.contrato.findFirstOrThrow({
    where: { organisationId: org.id, numeroExpediente: 'SERV/2023/041' },
    include: { poderAdjudicador: true },
  });

  const plantilla = await prisma.plantillaProcedimiento.findFirstOrThrow({
    where: { organisationId: org.id, tipo: 'PENALIDAD' },
    include: { hitos: { orderBy: { orden: 'asc' } } },
  });

  const existente = await prisma.expediente.findFirst({
    where: { organisationId: org.id, referencia: 'EXP-2026-0001' },
  });
  if (existente) {
    console.log('El expediente de demostración ya existe');
    return;
  }

  // Notified six working days ago: the ten-working-day allegation window is
  // still open but closing, which is the state worth showing.
  const apertura = sumarDias(hoyCivil(), -6);

  const calendario = await calendariosDe(
    contrato.poderAdjudicador.comunidadAutonoma,
    contrato.poderAdjudicador.municipioIne,
  );

  const expediente = await prisma.expediente.create({
    data: {
      organisationId: org.id,
      referencia: 'EXP-2026-0001',
      titulo: 'Penalidad por incidencias en la recogida de la zona norte',
      resumen:
        'El Ayuntamiento propone penalidad de 48.200 € por retrasos reiterados en la recogida durante el mes de junio. Se discuten tanto los hechos como la cuantía.',
      tipo: 'PENALIDAD',
      jurisdiccion: 'ADMINISTRATIVA',
      estado: 'EN_TRAMITE',
      contratoId: contrato.id,
      plantillaId: plantilla.id,
      organoCompetente: 'Ayuntamiento de Alcalá de Guadaíra — Servicio de Contratación',
      parteContraria: 'Ayuntamiento de Alcalá de Guadaíra',
      cuantia: 48_200,
      provisionContable: 24_000,
      probabilidadExito: 'MEDIA',
      fechaApertura: aDate(apertura),
    },
  });

  let plazos = 0;

  // The same pure planner the application uses, so the demo cannot show dates
  // the product would not have produced.
  const plan = planificarPasos(plantilla.hitos, apertura, calendario);
  const porOrden = new Map(plan.map((paso) => [paso.orden, paso]));

  for (const paso of plantilla.hitos) {
    const planificado = porOrden.get(paso.orden);

    const hito = await prisma.hito.create({
      data: {
        organisationId: org.id,
        expedienteId: expediente.id,
        orden: paso.orden,
        nombre: paso.nombre,
        tipo: paso.tipo,
        descripcion: paso.descripcion,
        // The first step already happened: the notification is what opened it.
        estado: paso.orden === 1 ? 'CUMPLIDO' : 'PENDIENTE',
        fechaReal: paso.orden === 1 ? aDate(apertura) : null,
        fechaPrevista: planificado?.fechaPrevista ? aDate(planificado.fechaPrevista) : null,
      },
    });

    const plazo = planificado?.plazo;
    if (!plazo) continue;

    await prisma.plazo.create({
      data: {
        organisationId: org.id,
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
        // The engine's audit trail is stored as JSON; Prisma wants the
        // array widened to its own input type.
        diasExcluidos: plazo.resultado.diasExcluidos as unknown as Prisma.InputJsonValue,
        esPreclusivo: plazo.esPreclusivo,
      },
    });

    plazos += 1;
    console.log(
      `  ${paso.nombre}: vence ${plazo.resultado.vencimiento}${
        plazo.completo ? '' : ' — CÁLCULO INCOMPLETO'
      }`,
    );
  }

  await prisma.actuacion.create({
    data: {
      organisationId: org.id,
      expedienteId: expediente.id,
      fecha: aDate(apertura),
      tipo: 'NOTIFICACION_RECIBIDA',
      descripcion:
        'Recibida por comparecencia en sede electrónica la propuesta de penalidad, con expediente de referencia PEN/2026/117.',
    },
  });

  console.log(`Expediente ${expediente.referencia} creado con ${String(plazos)} plazos`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
