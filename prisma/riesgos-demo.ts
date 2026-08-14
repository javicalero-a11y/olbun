import type { Prisma, PrismaClient } from '@prisma/client';

import { BANDAS_POR_DEFECTO, valorar, type Escala } from '../lib/domain/riesgos/matriz';
import { sembrarConfiguracionRiesgoDemo } from './configuracion-riesgos-demo';
import { INCIDENCIAS_DEMO } from './incidencias-demo-datos';

const DIA = 86_400_000;
const ACTOR = 'SYSTEM_DEMO';

function enDias(dias: number): Date {
  const fecha = new Date(Date.now() + dias * DIA);
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

const RIESGOS = [
  {
    referencia: 'RSG-2026-0001',
    contrato: 'SERV/2023/041',
    categoria: 'CONTRACTUAL',
    causa: 'Los partes de recogida llegan sin la trazabilidad GPS completa',
    evento: 'el Ayuntamiento puede considerar no acreditadas varias rutas del turno de noche',
    consecuencia: 'se puede imponer una penalidad y minorar la certificación mensual',
    inherente: [4, 5],
    residual: [3, 4],
    respuesta: 'MITIGAR',
    estado: 'EN_TRATAMIENTO',
    revisionEn: -7,
  },
  {
    referencia: 'RSG-2026-0002',
    contrato: 'DIP/2024/0117',
    categoria: 'PREVENCION',
    causa: 'Parte de la cuadrilla de poda trabaja cerca de calzada sin balizamiento reforzado',
    evento: 'puede producirse un alcance de vehículo durante una intervención',
    consecuencia: 'puede haber lesiones graves, paralización y responsabilidad contractual',
    inherente: [4, 5],
    residual: [2, 5],
    respuesta: 'MITIGAR',
    estado: 'EN_TRATAMIENTO',
    revisionEn: 12,
  },
  {
    referencia: 'RSG-2026-0003',
    contrato: 'CSS/2022/8814',
    categoria: 'LABORAL',
    causa: 'La bolsa de sustituciones no cubre todas las bajas sobrevenidas de fin de semana',
    evento: 'puede quedar incompleto un turno de limpieza hospitalaria',
    consecuencia: 'se incumplen frecuencias críticas y aumenta el riesgo de infección',
    inherente: [5, 5],
    residual: [4, 5],
    respuesta: 'MITIGAR',
    estado: 'EN_TRATAMIENTO',
    revisionEn: -18,
  },
  {
    referencia: 'RSG-2026-0004',
    contrato: 'EMV/2025/0042',
    categoria: 'ECONOMICO',
    causa: 'Los materiales de reparación acumulan una subida no prevista en oferta',
    evento: 'el coste real puede superar el precio unitario adjudicado',
    consecuencia: 'se erosiona el margen y se retrasa la compra de materiales críticos',
    inherente: [4, 4],
    residual: [3, 3],
    respuesta: 'MITIGAR',
    estado: 'CONTROLADO',
    revisionEn: 29,
  },
  {
    referencia: 'RSG-2026-0005',
    contrato: 'SERV/2026/007',
    categoria: 'LABORAL',
    causa: 'El listado de subrogación contiene categorías y antigüedades sin contrastar',
    evento: 'la oferta puede incorporar un coste salarial inferior al real',
    consecuencia: 'la movilización nace con déficit estructural y potencial conflicto laboral',
    inherente: [4, 5],
    residual: null,
    respuesta: 'MITIGAR',
    estado: 'IDENTIFICADO',
    revisionEn: 8,
  },
  {
    referencia: 'RSG-2026-0006',
    contrato: 'SERV/2023/041',
    categoria: 'MEDIOAMBIENTAL',
    causa: 'Dos vehículos de la flota presentan fugas intermitentes de hidráulico',
    evento: 'puede producirse un vertido durante la ruta urbana',
    consecuencia: 'se genera daño ambiental, indisponibilidad y comunicación al órgano',
    inherente: [3, 4],
    residual: [2, 3],
    respuesta: 'MITIGAR',
    estado: 'EN_TRATAMIENTO',
    revisionEn: 20,
  },
  {
    referencia: 'RSG-2026-0007',
    contrato: 'CSS/2022/8814',
    categoria: 'PROTECCION_DATOS',
    causa: 'Los partes de incidencias se comparten por correo con destinatarios manuales',
    evento: 'pueden enviarse datos de pacientes a una dirección incorrecta',
    consecuencia: 'se produce una brecha de confidencialidad con impacto regulatorio',
    inherente: [3, 5],
    residual: [2, 4],
    respuesta: 'MITIGAR',
    estado: 'EN_TRATAMIENTO',
    revisionEn: 5,
  },
  {
    referencia: 'RSG-2026-0008',
    contrato: 'DIP/2024/0117',
    categoria: 'OPERATIVO',
    causa: 'El inventario de arbolado no refleja las últimas talas y reposiciones',
    evento: 'la planificación puede omitir ejemplares que requieren inspección',
    consecuencia: 'se incumple el programa anual y aumenta la exposición por caída de ramas',
    inherente: [3, 4],
    residual: [3, 3],
    respuesta: 'MITIGAR',
    estado: 'EN_TRATAMIENTO',
    revisionEn: -2,
  },
  {
    referencia: 'RSG-2026-0009',
    contrato: 'EMV/2025/0042',
    categoria: 'REPUTACIONAL',
    causa: 'Las citas de reparación se reprograman sin un mensaje uniforme al inquilino',
    evento: 'pueden multiplicarse las reclamaciones públicas por falta de información',
    consecuencia: 'se deteriora la confianza del cliente y la valoración mensual del servicio',
    inherente: [3, 3],
    residual: [2, 3],
    respuesta: 'MITIGAR',
    estado: 'CONTROLADO',
    revisionEn: 43,
  },
  {
    referencia: 'RSG-2026-0010',
    contrato: 'SERV/2023/041',
    categoria: 'CUMPLIMIENTO',
    causa: 'El seguro de responsabilidad medioambiental entra en periodo de renovación',
    evento: 'puede existir un intervalo sin cobertura acreditada ante el órgano',
    consecuencia: 'se incumple una obligación esencial y puede suspenderse actividad',
    inherente: [2, 5],
    residual: [1, 5],
    respuesta: 'TRANSFERIR',
    estado: 'CONTROLADO',
    revisionEn: 15,
  },
  {
    referencia: 'RSG-2026-0011',
    contrato: 'CSS/2022/8814',
    categoria: 'OPERATIVO',
    causa: 'El contrato aparece prorrogado aunque la fecha registrada ya ha vencido',
    evento: 'puede prestarse servicio sin soporte documental de continuidad',
    consecuencia: 'se discute la cobertura contractual de trabajos y facturación',
    inherente: [5, 4],
    residual: null,
    respuesta: 'EVITAR',
    estado: 'IDENTIFICADO',
    revisionEn: -1,
  },
  {
    referencia: 'RSG-2026-0012',
    contrato: 'SERV/2026/007',
    categoria: 'CONTRACTUAL',
    causa: 'La oferta técnica depende de compromisos de terceros aún no formalizados',
    evento: 'un proveedor puede no mantener disponibilidad durante la movilización',
    consecuencia: 'no se cumplen medios ofertados y se compromete la adjudicación',
    inherente: [3, 4],
    residual: [2, 3],
    respuesta: 'TRANSFERIR',
    estado: 'EN_TRATAMIENTO',
    revisionEn: 24,
  },
] as const;

export async function sembrarRiesgosDemo(
  prisma: PrismaClient,
  organisationId: string,
): Promise<{ riesgos: number; incidencias: number }> {
  const categorias = await sembrarConfiguracionRiesgoDemo(prisma, organisationId, ACTOR);

  const contratos = await prisma.contrato.findMany({
    where: { organisationId },
    select: { id: true, numeroExpediente: true },
  });
  const contratoId = new Map(
    contratos.map((contrato) => [contrato.numeroExpediente, contrato.id]),
  );
  const bandasJson = BANDAS_POR_DEFECTO.map((banda) => ({
    ...banda,
  })) as unknown as Prisma.InputJsonValue;

  for (const [indice, semilla] of RIESGOS.entries()) {
    const [probabilidadInherente, impactoInherente] = semilla.inherente as readonly [
      Escala,
      Escala,
    ];
    const residual = semilla.residual as readonly [Escala, Escala] | null;
    const categoriaId = categorias.get(semilla.categoria);
    if (!categoriaId) throw new Error(`Categoría de demo ausente: ${semilla.categoria}`);
    const riesgo = await prisma.riesgo.upsert({
      where: { organisationId_referencia: { organisationId, referencia: semilla.referencia } },
      update: {
        categoriaId,
        proximaRevision: enDias(semilla.revisionEn),
        estado: semilla.estado,
        deletedAt: null,
      },
      create: {
        organisationId,
        referencia: semilla.referencia,
        contratoId: contratoId.get(semilla.contrato) ?? null,
        categoriaId,
        causa: semilla.causa,
        evento: semilla.evento,
        consecuencia: semilla.consecuencia,
        probabilidadInherente,
        impactoInherente,
        probabilidadResidual: residual?.[0] ?? null,
        impactoResidual: residual?.[1] ?? null,
        respuesta: semilla.respuesta,
        estado: semilla.estado,
        proximaRevision: enDias(semilla.revisionEn),
        frecuenciaRevisionDias: indice % 3 === 0 ? 30 : 90,
        createdById: ACTOR,
      },
    });

    const inicial = await prisma.valoracionRiesgo.findFirst({
      where: { organisationId, riesgoId: riesgo.id, tipo: 'INICIAL' },
      select: { id: true },
    });
    if (!inicial) {
      const inherente = valorar(probabilidadInherente, impactoInherente);
      const valorResidual = residual ? valorar(residual[0], residual[1]) : null;
      await prisma.valoracionRiesgo.create({
        data: {
          organisationId,
          riesgoId: riesgo.id,
          tipo: 'INICIAL',
          probabilidadInherente,
          impactoInherente,
          puntuacionInherente: inherente.puntuacion,
          nivelInherente: inherente.nivel,
          probabilidadResidual: valorResidual?.probabilidad ?? null,
          impactoResidual: valorResidual?.impacto ?? null,
          puntuacionResidual: valorResidual?.puntuacion ?? null,
          nivelResidual: valorResidual?.nivel ?? null,
          justificacion: 'Valoración de apertura del registro de demostración.',
          bandas: bandasJson,
          valoradaEn: enDias(-90 + indice * 4),
          valoradaPorId: ACTOR,
          createdById: ACTOR,
        },
      });
    }

    if (indice < 8) {
      const titulo =
        indice % 2 === 0 ? 'Revisión semanal con evidencia' : 'Lista de comprobación reforzada';
      const control = await prisma.controlRiesgo.findFirst({
        where: { organisationId, riesgoId: riesgo.id, titulo },
      });
      if (!control) {
        await prisma.controlRiesgo.create({
          data: {
            organisationId,
            riesgoId: riesgo.id,
            titulo,
            descripcion:
              'El responsable conserva la evidencia de ejecución y revisa las desviaciones antes del cierre mensual.',
            tipo: indice % 2 === 0 ? 'DETECTIVO' : 'PREVENTIVO',
            eficacia: residual ? 'PARCIAL' : 'NO_EVALUADO',
            esExistente: true,
            proximaPrueba: enDias(20 + indice),
            createdById: ACTOR,
          },
        });
      }
    }

    if (indice < 6) {
      const titulo = `Tratamiento ${semilla.referencia}`;
      const accion = await prisma.accionCorrectora.findFirst({
        where: { organisationId, riesgoId: riesgo.id, titulo },
      });
      if (!accion) {
        await prisma.accionCorrectora.create({
          data: {
            organisationId,
            riesgoId: riesgo.id,
            titulo,
            descripcion:
              'Completar la medida, adjuntar evidencia y someterla a verificación independiente.',
            prioridad: indice < 3 ? 'URGENTE' : 'ALTA',
            estado: indice === 0 ? 'BLOQUEADA' : indice === 1 ? 'EN_CURSO' : 'PENDIENTE',
            progreso: indice === 0 ? 35 : indice === 1 ? 60 : 0,
            motivoBloqueo:
              indice === 0 ? 'Pendiente de datos GPS del proveedor de flota.' : null,
            fechaLimite: enDias(indice - 2),
            createdById: ACTOR,
          },
        });
      }
    }
  }

  for (const [indice, semilla] of INCIDENCIAS_DEMO.entries()) {
    const [referencia, contrato, tipo, gravedad, dias, descripcion, estado] = semilla;
    const incidencia = await prisma.incidencia.upsert({
      where: { organisationId_referencia: { organisationId, referencia } },
      update: { estado, deletedAt: null },
      create: {
        organisationId,
        referencia,
        contratoId: contratoId.get(contrato) ?? null,
        tipo,
        gravedad,
        estado,
        fechaHecho: enDias(dias),
        fechaComunicacion: enDias(dias + 1),
        lugar: 'Centro operativo del contrato',
        descripcion,
        medidasInmediatas:
          'Se aseguró la zona, se informó al mando y se conservó la evidencia disponible.',
        causaRaiz:
          estado === 'CERRADA'
            ? 'La supervisión de cierre no comprobaba automáticamente todas las rutas asignadas.'
            : null,
        leccionesAprendidas:
          estado === 'CERRADA'
            ? 'La comprobación automática debe completarse antes de validar el parte diario.'
            : null,
        fechaCierre: estado === 'CERRADA' ? enDias(dias + 8) : null,
        esNotificableAAutoridad: tipo === 'SEGURIDAD_DATOS' || tipo === 'ACCIDENTE',
        comunicadaAlOrgano: indice < 4,
        fechaComunicacionOrgano: indice < 4 ? enDias(dias + 1) : null,
        createdById: ACTOR,
      },
    });

    if (indice < 5) {
      const titulo = `Seguimiento ${referencia}`;
      const accion = await prisma.accionCorrectora.findFirst({
        where: { organisationId, incidenciaId: incidencia.id, titulo },
      });
      if (!accion) {
        await prisma.accionCorrectora.create({
          data: {
            organisationId,
            incidenciaId: incidencia.id,
            titulo,
            descripcion:
              'Cerrar la investigación, aplicar la medida correctora y verificar que no se repite.',
            prioridad: indice < 3 ? 'URGENTE' : 'ALTA',
            estado: indice === 0 ? 'VERIFICADA' : 'EN_CURSO',
            progreso: indice === 0 ? 100 : 45,
            fechaLimite: enDias(dias + 10),
            fechaCierre: indice === 0 ? enDias(-5) : null,
            verificadaPorId: indice === 0 ? ACTOR : null,
            verificadaEn: indice === 0 ? enDias(-5) : null,
            eficacia: indice === 0 ? 'Sin repetición en los siete turnos posteriores.' : null,
            createdById: ACTOR,
          },
        });
      }
    }
  }

  return { riesgos: RIESGOS.length, incidencias: INCIDENCIAS_DEMO.length };
}
