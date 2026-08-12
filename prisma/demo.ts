import type { PrismaClient } from '@prisma/client';

import { PLANTILLAS_SEMILLA } from '../lib/domain/expedientes/plantillas-semilla';

/**
 * Demo dataset (SPEC §10).
 *
 * A fictional facilities-and-environmental-services provider with the shape of
 * contract portfolio a real one carries: a county council, a city council, a
 * health service and a housing body; contracts at different stages; and — the
 * point of the whole thing — renewal deadlines that are actually close, so the
 * warnings on screen are real rather than decorative.
 *
 * Dates are computed relative to today, so the demo never goes stale.
 */

const DIA = 86_400_000;

function enDias(dias: number): Date {
  const d = new Date(Date.now() + dias * DIA);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

interface OrganoSemilla {
  clave: string;
  nombre: string;
  tipo:
    'AYUNTAMIENTO' | 'DIPUTACION' | 'SERVICIO_SALUD' | 'EMPRESA_PUBLICA' | 'COMUNIDAD_AUTONOMA';
  comunidadAutonoma: string;
  provincia: string;
  municipioNombre: string;
  municipioIne: string;
  codigoDir3: string;
}

const ORGANOS: OrganoSemilla[] = [
  {
    clave: 'alcala',
    nombre: 'Ayuntamiento de Alcalá de Guadaíra',
    tipo: 'AYUNTAMIENTO',
    comunidadAutonoma: 'Andalucía',
    provincia: 'Sevilla',
    municipioNombre: 'Alcalá de Guadaíra',
    municipioIne: '41004',
    codigoDir3: 'L01410045',
  },
  {
    clave: 'diputacion',
    nombre: 'Diputación Provincial de Sevilla',
    tipo: 'DIPUTACION',
    comunidadAutonoma: 'Andalucía',
    provincia: 'Sevilla',
    municipioNombre: 'Sevilla',
    municipioIne: '41091',
    codigoDir3: 'L02000041',
  },
  {
    clave: 'sas',
    nombre: 'Servicio Andaluz de Salud — Área Sanitaria Sur de Sevilla',
    tipo: 'SERVICIO_SALUD',
    comunidadAutonoma: 'Andalucía',
    provincia: 'Sevilla',
    municipioNombre: 'Sevilla',
    municipioIne: '41091',
    codigoDir3: 'A01004073',
  },
  {
    clave: 'emvisesa',
    nombre: 'Empresa Municipal de Vivienda, Suelo y Equipamiento de Sevilla',
    tipo: 'EMPRESA_PUBLICA',
    comunidadAutonoma: 'Andalucía',
    provincia: 'Sevilla',
    municipioNombre: 'Sevilla',
    municipioIne: '41091',
    codigoDir3: 'L03410917',
  },
];

interface ContratoSemilla {
  organo: string;
  numeroExpediente: string;
  objeto: string;
  tipo: 'SERVICIOS' | 'OBRAS' | 'SUMINISTROS' | 'CONCESION_SERVICIOS';
  procedimiento: 'ABIERTO' | 'ABIERTO_SIMPLIFICADO' | 'ACUERDO_MARCO' | 'CONTRATO_MENOR';
  estado:
    'EN_EJECUCION' | 'PRORROGADO' | 'LICITACION' | 'FORMALIZADO' | 'FINALIZADO' | 'SUSPENDIDO';
  /** Days from today; negative is in the past. */
  inicioEnDias: number;
  finEnDias: number;
  preavisoProrrogaDias?: number;
  duracionInicialMeses?: number;
  importe: number;
  subrogacion?: boolean;
  revisionPrecios?: boolean;
  garantiaMeses?: number;
  lote?: string;
}

const CONTRATOS: ContratoSemilla[] = [
  {
    organo: 'alcala',
    numeroExpediente: 'SERV/2023/041',
    objeto: 'Limpieza viaria y recogida de residuos sólidos urbanos',
    tipo: 'SERVICIOS',
    procedimiento: 'ABIERTO',
    estado: 'EN_EJECUCION',
    inicioEnDias: -890,
    // Preaviso de 90 días: vence dentro de dos semanas. Éste es el que debe
    // saltar en rojo en la demostración.
    finEnDias: 104,
    preavisoProrrogaDias: 90,
    duracionInicialMeses: 36,
    importe: 4_820_000,
    subrogacion: true,
    revisionPrecios: true,
    garantiaMeses: 12,
  },
  {
    organo: 'diputacion',
    numeroExpediente: 'DIP/2024/0117',
    objeto: 'Mantenimiento de zonas verdes y arbolado viario en centros provinciales',
    tipo: 'SERVICIOS',
    procedimiento: 'ABIERTO',
    estado: 'EN_EJECUCION',
    inicioEnDias: -430,
    finEnDias: 295,
    preavisoProrrogaDias: 60,
    duracionInicialMeses: 24,
    importe: 1_260_400,
    subrogacion: true,
    garantiaMeses: 6,
    lote: 'Lote 2',
  },
  {
    organo: 'sas',
    numeroExpediente: 'CSS/2022/8814',
    objeto: 'Limpieza y desinfección de centros de atención primaria',
    tipo: 'SERVICIOS',
    procedimiento: 'ACUERDO_MARCO',
    estado: 'PRORROGADO',
    inicioEnDias: -1240,
    // Ya vencido y sigue marcado como activo: el aviso debe decirlo.
    finEnDias: -18,
    preavisoProrrogaDias: 90,
    duracionInicialMeses: 36,
    importe: 3_115_000,
    subrogacion: true,
    garantiaMeses: 12,
  },
  {
    organo: 'emvisesa',
    numeroExpediente: 'EMV/2025/0042',
    objeto: 'Conservación y pequeñas reparaciones en viviendas municipales',
    tipo: 'SERVICIOS',
    procedimiento: 'ABIERTO_SIMPLIFICADO',
    estado: 'EN_EJECUCION',
    inicioEnDias: -120,
    finEnDias: 610,
    duracionInicialMeses: 24,
    importe: 742_800,
    garantiaMeses: 6,
  },
  {
    organo: 'alcala',
    numeroExpediente: 'SERV/2026/007',
    objeto: 'Conserjería y control de accesos en instalaciones deportivas municipales',
    tipo: 'SERVICIOS',
    procedimiento: 'ABIERTO',
    estado: 'LICITACION',
    inicioEnDias: 60,
    finEnDias: 790,
    duracionInicialMeses: 24,
    importe: 388_500,
    subrogacion: true,
  },
  {
    organo: 'diputacion',
    numeroExpediente: 'DIP/2021/0903',
    objeto: 'Servicio de catering en centros de día',
    tipo: 'SERVICIOS',
    procedimiento: 'ABIERTO',
    estado: 'FINALIZADO',
    inicioEnDias: -1600,
    finEnDias: -140,
    duracionInicialMeses: 48,
    importe: 2_050_000,
  },
];

/** Seeds the procedure templates every tenant starts with. */
async function sembrarPlantillas(prisma: PrismaClient, organisationId: string): Promise<void> {
  for (const semilla of PLANTILLAS_SEMILLA) {
    const plantilla = await prisma.plantillaProcedimiento.upsert({
      where: {
        organisationId_tipo_nombre: {
          organisationId,
          tipo: semilla.tipo as never,
          nombre: semilla.nombre,
        },
      },
      update: { descripcion: semilla.descripcion },
      create: {
        organisationId,
        nombre: semilla.nombre,
        tipo: semilla.tipo as never,
        jurisdiccion: semilla.jurisdiccion as never,
        descripcion: semilla.descripcion,
        esDelSistema: true,
      },
      select: { id: true },
    });

    for (const hito of semilla.hitos) {
      await prisma.plantillaHito.upsert({
        where: { plantillaId_orden: { plantillaId: plantilla.id, orden: hito.orden } },
        update: {
          nombre: hito.nombre,
          plazoCantidad: hito.plazoCantidad ?? null,
          plazoComputo: (hito.plazoComputo ?? null) as never,
          plazoFundamento: hito.plazoFundamento ?? null,
        },
        create: {
          organisationId,
          plantillaId: plantilla.id,
          orden: hito.orden,
          nombre: hito.nombre,
          tipo: hito.tipo,
          descripcion: hito.descripcion ?? null,
          plazoCantidad: hito.plazoCantidad ?? null,
          plazoComputo: (hito.plazoComputo ?? null) as never,
          plazoFundamento: hito.plazoFundamento ?? null,
          plazoEsPreclusivo: hito.plazoEsPreclusivo ?? false,
          desplazamientoDias: hito.desplazamientoDias ?? null,
        },
      });
    }
  }
}

export async function sembrarDemo(prisma: PrismaClient, organisationId: string): Promise<void> {
  await sembrarPlantillas(prisma, organisationId);

  const idsOrgano = new Map<string, string>();

  for (const organo of ORGANOS) {
    const existente = await prisma.poderAdjudicador.findFirst({
      where: { organisationId, nombre: organo.nombre },
      select: { id: true },
    });

    const registro =
      existente ??
      (await prisma.poderAdjudicador.create({
        data: {
          organisationId,
          nombre: organo.nombre,
          tipo: organo.tipo,
          codigoDir3: organo.codigoDir3,
          comunidadAutonoma: organo.comunidadAutonoma,
          provincia: organo.provincia,
          municipioNombre: organo.municipioNombre,
          municipioIne: organo.municipioIne,
        },
        select: { id: true },
      }));

    idsOrgano.set(organo.clave, registro.id);
  }

  for (const contrato of CONTRATOS) {
    const poderAdjudicadorId = idsOrgano.get(contrato.organo);
    if (!poderAdjudicadorId) continue;

    await prisma.contrato.upsert({
      where: {
        organisationId_numeroExpediente: {
          organisationId,
          numeroExpediente: contrato.numeroExpediente,
        },
      },
      update: {
        fechaInicio: enDias(contrato.inicioEnDias),
        fechaFinPrevista: enDias(contrato.finEnDias),
        estado: contrato.estado,
      },
      create: {
        organisationId,
        poderAdjudicadorId,
        numeroExpediente: contrato.numeroExpediente,
        objeto: contrato.objeto,
        tipo: contrato.tipo,
        procedimiento: contrato.procedimiento,
        estado: contrato.estado,
        lote: contrato.lote ?? null,
        fechaFormalizacion: enDias(contrato.inicioEnDias - 15),
        fechaInicio: enDias(contrato.inicioEnDias),
        fechaFinPrevista: enDias(contrato.finEnDias),
        duracionInicialMeses: contrato.duracionInicialMeses ?? null,
        preavisoProrrogaDias: contrato.preavisoProrrogaDias ?? null,
        importeAdjudicacion: contrato.importe,
        plazoGarantiaMeses: contrato.garantiaMeses ?? null,
        haySubrogacionPersonal: contrato.subrogacion ?? false,
        hayRevisionPrecios: contrato.revisionPrecios ?? false,
      },
    });
  }
}
