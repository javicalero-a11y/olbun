import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { Role } from '@prisma/client';

import { registrarEvento } from '@/lib/audit/registrar';
import { tenantClient, tenantTransaction } from '@/lib/db/tenant';
import { serverEnv } from '@/lib/env';
import { analizarComunicacion } from '@/lib/services/detecciones';
import {
  interpretar,
  MODELO_CLAUDE,
  parametrosClaudeBatch,
  PROMPT_VERSION,
} from '@/lib/services/detecciones/claude';

interface ActorLote {
  id: string;
  email: string;
  role: Role;
}

function cliente(cliente?: Anthropic): Anthropic {
  if (cliente) return cliente;
  const apiKey = serverEnv().ANTHROPIC_API_KEY;
  if (!apiKey)
    throw new Error('Configura ANTHROPIC_API_KEY para analizar el histórico por lotes.');
  return new Anthropic({ apiKey });
}

export async function crearLoteHistorico(
  organisationId: string,
  buzonId: string,
  actor: ActorLote,
  clienteInyectado?: Anthropic,
): Promise<{ loteId: string; total: number }> {
  const db = tenantClient(organisationId);
  const buzon = await db.buzonConectado.findFirst({
    where: {
      id: buzonId,
      tipo: { in: ['GOOGLE_FUNCIONAL', 'MS365_FUNCIONAL'] },
      deletedAt: null,
    },
    select: { id: true, direccion: true },
  });
  if (!buzon) throw new Error('El buzón conectado no existe.');

  const comunicaciones = await db.comunicacion.findMany({
    where: {
      buzonId,
      deletedAt: null,
      detecciones: { none: { deletedAt: null } },
      itemsLoteDeteccion: { none: {} },
    },
    select: {
      id: true,
      asunto: true,
      de: true,
      fechaEnvio: true,
      fechaRecepcion: true,
      cuerpoTexto: true,
    },
    orderBy: { fechaRecepcion: 'asc' },
    take: 500,
  });
  if (comunicaciones.length === 0) {
    throw new Error('No hay mensajes históricos pendientes de análisis por lotes.');
  }

  const api = cliente(clienteInyectado);
  const loteRemoto = await api.messages.batches.create({
    requests: comunicaciones.map((comunicacion) => ({
      custom_id: `c_${comunicacion.id}`,
      params: parametrosClaudeBatch({
        asunto: comunicacion.asunto,
        de: comunicacion.de,
        fecha: comunicacion.fechaEnvio ?? comunicacion.fechaRecepcion,
        cuerpo: comunicacion.cuerpoTexto ?? '',
      }),
    })),
  });

  return tenantTransaction(organisationId, async (tx) => {
    const lote = await tx.loteDeteccion.create({
      data: {
        organisationId,
        buzonId,
        proveedorLoteId: loteRemoto.id,
        total: comunicaciones.length,
        modelId: MODELO_CLAUDE,
        promptVersion: PROMPT_VERSION,
        createdById: actor.id,
        items: {
          create: comunicaciones.map((comunicacion) => ({
            organisationId,
            comunicacionId: comunicacion.id,
            customId: `c_${comunicacion.id}`,
          })),
        },
      },
      select: { id: true },
    });

    await registrarEvento(
      tx,
      {
        organisationId,
        actorId: actor.id,
        actorEmail: actor.email,
        actorRol: actor.role,
      },
      {
        tipo: 'CREACION',
        accion: 'deteccion.lote_crear',
        entidad: 'LoteDeteccion',
        entidadId: lote.id,
        descripcion: `${buzon.direccion ?? 'Buzón'}: ${String(comunicaciones.length)} mensajes`,
        despues: {
          total: comunicaciones.length,
          modelId: MODELO_CLAUDE,
          promptVersion: PROMPT_VERSION,
        },
      },
    );
    return { loteId: lote.id, total: comunicaciones.length };
  });
}

function textoDeResultado(
  resultado: Anthropic.Messages.MessageBatchIndividualResponse,
): string {
  if (resultado.result.type !== 'succeeded') {
    throw new Error(`El proveedor devolvió el resultado ${resultado.result.type}.`);
  }
  const bloque = resultado.result.message.content.findLast((parte) => parte.type === 'text');
  if (!bloque || bloque.type !== 'text') throw new Error('El lote no devolvió texto.');
  return bloque.text;
}

export async function recogerLoteHistorico(
  organisationId: string,
  loteId: string,
  actor: ActorLote,
  clienteInyectado?: Anthropic,
): Promise<{ terminado: boolean; completados: number; fallidos: number }> {
  const db = tenantClient(organisationId);
  const lote = await db.loteDeteccion.findFirst({
    where: { id: loteId },
    select: {
      id: true,
      proveedorLoteId: true,
      estado: true,
      items: {
        where: { estado: 'PENDIENTE' },
        select: { id: true, customId: true, comunicacionId: true },
      },
    },
  });
  if (!lote) throw new Error('El lote no existe.');
  if (lote.estado !== 'EN_PROCESO') {
    const totales = await db.itemLoteDeteccion.groupBy({
      by: ['estado'],
      where: { loteId },
      _count: true,
    });
    return {
      terminado: true,
      completados: totales.find((x) => x.estado === 'COMPLETADO')?._count ?? 0,
      fallidos: totales.find((x) => x.estado === 'ERROR')?._count ?? 0,
    };
  }

  const api = cliente(clienteInyectado);
  const remoto = await api.messages.batches.retrieve(lote.proveedorLoteId);
  if (remoto.processing_status !== 'ended') {
    return { terminado: false, completados: 0, fallidos: 0 };
  }

  const resultados = new Map<string, Anthropic.Messages.MessageBatchIndividualResponse>();
  for await (const resultado of await api.messages.batches.results(lote.proveedorLoteId)) {
    resultados.set(resultado.custom_id, resultado);
  }

  return tenantTransaction(organisationId, async (tx) => {
    let completados = 0;
    let fallidos = 0;
    for (const item of lote.items) {
      try {
        const resultado = resultados.get(item.customId);
        if (!resultado) throw new Error('El lote no incluyó este mensaje.');
        const mensaje = resultado.result.type === 'succeeded' ? resultado.result.message : null;
        const propuestas = interpretar(textoDeResultado(resultado));
        await analizarComunicacion(tx, organisationId, item.comunicacionId, {
          nombre: mensaje?.model ?? MODELO_CLAUDE,
          analizar: () =>
            Promise.resolve({
              propuestas,
              modelId: mensaje?.model ?? MODELO_CLAUDE,
              promptVersion: PROMPT_VERSION,
              costeTokens: mensaje
                ? mensaje.usage.input_tokens + mensaje.usage.output_tokens
                : undefined,
            }),
        });
        await tx.itemLoteDeteccion.update({
          where: { id: item.id },
          data: { estado: 'COMPLETADO', completedAt: new Date(), error: null },
        });
        completados += 1;
      } catch (error) {
        await tx.itemLoteDeteccion.update({
          where: { id: item.id },
          data: {
            estado: 'ERROR',
            completedAt: new Date(),
            error: error instanceof Error ? error.message.slice(0, 1000) : 'Resultado inválido',
          },
        });
        fallidos += 1;
      }
    }

    const estado = fallidos === 0 ? 'COMPLETADO' : completados > 0 ? 'PARCIAL' : 'ERROR';
    await tx.loteDeteccion.update({
      where: { id: lote.id },
      data: { estado, completados, fallidos, completedAt: new Date() },
    });
    await registrarEvento(
      tx,
      {
        organisationId,
        actorId: actor.id,
        actorEmail: actor.email,
        actorRol: actor.role,
      },
      {
        tipo: 'MODIFICACION',
        accion: 'deteccion.lote_recoger',
        entidad: 'LoteDeteccion',
        entidadId: lote.id,
        descripcion: `${String(completados)} completados, ${String(fallidos)} fallidos`,
        despues: { estado, completados, fallidos },
      },
    );
    return { terminado: true, completados, fallidos };
  });
}
