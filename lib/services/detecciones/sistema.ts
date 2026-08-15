import 'server-only';

import {
  agruparPorContratoYTipo,
  hallazgosDeCertificaciones,
  hallazgosDeCobertura,
  hallazgosDePersonalClave,
} from '@/lib/domain/personal/infradotacion';
import { coberturaDeContrato } from '@/lib/services/personal/ausencias';
import { definicionDe } from '@/lib/domain/personal/ausencias';
import { hoyEn } from '@/lib/domain/fecha';
import type { FechaCivil } from '@/lib/domain/fecha';
import type { Hallazgo } from '@/lib/domain/personal/infradotacion';
import type { Periodo } from '@/lib/domain/personal/ausencias';
import type { Prisma } from '@prisma/client';
import type { TenantTransactionClient } from '@/lib/db/tenant';

/**
 * The detection engine reading the system instead of the inbox (SPEC §4.4, M12).
 *
 * Everything the Claude engine gives the queue, this gives too — the same
 * table, the same triage, the same human confirmation. What it does not give
 * is a quote, because there is no text: the evidence is a computation over the
 * tenant's own data, stored in full so a reviewer can redo it.
 *
 * **Confidence is 1 and that is not a boast.** The engine is not guessing
 * whether the hours add up; it added them. What stays with the person is what
 * the arithmetic *means* — a deficit on paper may be a rota the software
 * cannot see yet, and it becomes a risk to the contract only when somebody
 * says it is.
 *
 * Re-running is safe and is meant to be routine: a finding still waiting in
 * the queue is refreshed in place, and one a person already discarded is never
 * resurrected. That last rule is the same one the message engine follows, and
 * for the same reason — software that keeps re-raising a decision somebody has
 * already made teaches people to ignore it.
 */

/**
 * Which rules produced a finding, and which version of them.
 *
 * Versioned for the same reason the Claude engine is: when somebody says the
 * queue got noisier last week, this is what makes that answerable. Bump the
 * version whenever a threshold or a rule changes.
 */
export const MOTOR_SISTEMA = 'reglas-sistema-1';
export const VERSION_SISTEMA = '2026-08-15.1';

export interface ResultadoEvaluacion {
  creadas: number;
  actualizadas: number;
  /** Findings whose kind a person had already discarded for that contract. */
  omitidasPorDescarte: number;
  contratosRevisados: number;
}

/** The window coverage is judged over. A month is the unit pliegos are written in. */
function ventanaDelMes(hoy: FechaCivil): Periodo {
  return { desde: `${hoy.slice(0, 7)}-01` as FechaCivil, hasta: hoy };
}

export async function evaluarEstadoDelSistema(
  db: TenantTransactionClient,
  organisationId: string,
  hoy: FechaCivil = hoyEn(),
): Promise<ResultadoEvaluacion> {
  const periodo = ventanaDelMes(hoy);

  const contratos = await db.contrato.findMany({
    where: { deletedAt: null, estado: { in: ['EN_EJECUCION', 'FORMALIZADO'] } },
    select: { id: true },
  });

  const categorias = await db.categoriaProfesional.findMany({
    where: { deletedAt: null },
    select: { id: true, denominacion: true },
  });

  const nombreDeCategoria = (categoriaId: string) =>
    categorias.find((categoria) => categoria.id === categoriaId)?.denominacion ?? 'Categoría';

  const hallazgos: Hallazgo[] = [];

  for (const contrato of contratos) {
    const cobertura = await coberturaDeContrato(db, contrato.id, periodo);
    hallazgos.push(
      ...hallazgosDeCobertura(contrato.id, periodo, cobertura.filas, nombreDeCategoria),
    );

    // Personal clave: sólo quien está marcado como tal en la adscripción, y
    // sólo mientras la ausencia esté viva dentro de la ventana.
    const adscripcionesClave = await db.adscripcionContrato.findMany({
      where: { contratoId: contrato.id, deletedAt: null, esPersonalClave: true },
      select: {
        empleadoId: true,
        empleado: {
          select: {
            nombre: true,
            apellidos: true,
            ausencias: {
              where: {
                deletedAt: null,
                fechaInicio: { lte: new Date(`${periodo.hasta}T00:00:00.000Z`) },
              },
              select: {
                tipo: true,
                fechaInicio: true,
                fechaFinPrevista: true,
                fechaFinReal: true,
                requiereSustitucion: true,
                sustitucionCubiertaPorId: true,
              },
            },
          },
        },
      },
    });

    for (const adscripcion of adscripcionesClave) {
      for (const ausencia of adscripcion.empleado.ausencias) {
        const fin = ausencia.fechaFinReal ?? ausencia.fechaFinPrevista;
        const hasta = fin ? fin.toISOString().slice(0, 10) : null;

        // Ya terminada antes de la ventana: no es un puesto sin cubrir hoy.
        if (hasta !== null && hasta < periodo.desde) continue;

        hallazgos.push(
          ...hallazgosDePersonalClave([
            {
              empleadoId: adscripcion.empleadoId,
              nombreCompleto: `${adscripcion.empleado.nombre} ${adscripcion.empleado.apellidos}`,
              contratoId: contrato.id,
              tipo: ausencia.tipo,
              etiquetaTipo: definicionDe(ausencia.tipo).etiqueta,
              desde: ausencia.fechaInicio.toISOString().slice(0, 10),
              hasta,
              requiereSustitucion: ausencia.requiereSustitucion,
              sustitutoId: ausencia.sustitucionCubiertaPorId,
            },
          ]),
        );
      }
    }

    const certificaciones = await db.certificacionEmpleado.findMany({
      where: {
        deletedAt: null,
        empleado: {
          adscripciones: { some: { contratoId: contrato.id, deletedAt: null } },
        },
      },
      select: {
        empleadoId: true,
        fechaCaducidad: true,
        empleado: { select: { nombre: true, apellidos: true } },
        tipo: { select: { nombre: true, esObligatoria: true } },
      },
    });

    hallazgos.push(
      ...hallazgosDeCertificaciones(
        certificaciones.map((certificacion) => ({
          empleadoId: certificacion.empleadoId,
          nombreCompleto: `${certificacion.empleado.nombre} ${certificacion.empleado.apellidos}`,
          contratoId: contrato.id,
          tipoNombre: certificacion.tipo.nombre,
          esObligatoria: certificacion.tipo.esObligatoria,
          fechaCaducidad: certificacion.fechaCaducidad
            ? certificacion.fechaCaducidad.toISOString().slice(0, 10)
            : null,
        })),
        hoy,
      ),
    );
  }

  const agrupados = agruparPorContratoYTipo(hallazgos);

  let creadas = 0;
  let actualizadas = 0;
  let omitidasPorDescarte = 0;

  for (const hallazgo of agrupados) {
    const existente = await db.deteccion.findFirst({
      where: { contratoId: hallazgo.contratoId, tipo: hallazgo.tipo, deletedAt: null },
      select: { id: true, estado: true },
    });

    const datos = {
      resumen: hallazgo.resumen,
      ...hallazgo.datos,
    } as Prisma.InputJsonValue;

    if (!existente) {
      await db.deteccion.create({
        data: {
          organisationId,
          origen: 'SISTEMA',
          contratoId: hallazgo.contratoId,
          tipo: hallazgo.tipo,
          // Arithmetic, not inference. The uncertainty that remains is about
          // meaning, and meaning is the reviewer's job.
          confianza: 1,
          confianzaModelo: 1,
          modelId: MOTOR_SISTEMA,
          promptVersion: VERSION_SISTEMA,
          // No hay texto del que citar: la prueba es el cálculo.
          extractos: [] as Prisma.InputJsonValue,
          datosExtraidos: datos,
        },
      });
      creadas += 1;
      continue;
    }

    // Nunca se resucita lo que alguien ya descartó, ni se pisa lo que ya se
    // convirtió en un riesgo: eso sería volver a preguntar algo ya decidido.
    if (existente.estado !== 'NUEVA') {
      omitidasPorDescarte += 1;
      continue;
    }

    await db.deteccion.update({
      where: { id: existente.id },
      data: {
        datosExtraidos: datos,
        confianza: 1,
        modelId: MOTOR_SISTEMA,
        promptVersion: VERSION_SISTEMA,
      },
    });
    actualizadas += 1;
  }

  return {
    creadas,
    actualizadas,
    omitidasPorDescarte,
    contratosRevisados: contratos.length,
  };
}

/** Reads the stored computation back as the one line the queue shows. */
export function resumenDeDatos(datos: unknown): string | null {
  if (datos === null || typeof datos !== 'object') return null;
  const resumen = (datos as Record<string, unknown>)['resumen'];
  return typeof resumen === 'string' && resumen.length > 0 ? resumen : null;
}
