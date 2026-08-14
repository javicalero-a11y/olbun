import type Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { identityClientBecause, tenantTransaction } from '@/lib/db/tenant';
import { crearLoteHistorico, recogerLoteHistorico } from '@/lib/services/buzones/lotes';

describe('lotes históricos de detección', () => {
  const elevated = identityClientBecause('integration test owns disposable batch tenants');
  const suffix = randomUUID().slice(0, 8);
  let organisationId = '';
  let otherOrganisationId = '';
  let buzonId = '';

  beforeAll(async () => {
    const [org, other] = await elevated.$transaction([
      elevated.organisation.create({
        data: { name: `Lotes ${suffix}`, slug: `lotes-${suffix}` },
        select: { id: true },
      }),
      elevated.organisation.create({
        data: { name: `Lotes otra ${suffix}`, slug: `lotes-otra-${suffix}` },
        select: { id: true },
      }),
    ]);
    organisationId = org.id;
    otherOrganisationId = other.id;

    buzonId = await tenantTransaction(organisationId, async (tx) => {
      const buzon = await tx.buzonConectado.create({
        data: {
          organisationId,
          tipo: 'GOOGLE_FUNCIONAL',
          nombre: `contratos-${suffix}`,
          direccion: `contratos-${suffix}@example.test`,
          estadoOAuth: 'ACTIVO',
        },
        select: { id: true },
      });
      await tx.comunicacion.create({
        data: {
          organisationId,
          buzonId: buzon.id,
          messageIdRFC: `<batch-${suffix}@example.test>`,
          huella: suffix.padEnd(64, '0'),
          direccion: 'ENTRANTE',
          de: 'autoridad@example.test',
          para: [`contratos-${suffix}@example.test`],
          cc: [],
          asunto: 'Carta corriente sin señales',
          fechaRecepcion: new Date(),
          cuerpoTexto: 'Se remite el acta de la reunión ordinaria.',
        },
      });
      return buzon.id;
    });
  });

  afterAll(async () => {
    if (!organisationId || !otherOrganisationId) return;
    await elevated.$transaction([
      elevated.itemLoteDeteccion.deleteMany({ where: { organisationId } }),
      elevated.loteDeteccion.deleteMany({ where: { organisationId } }),
      elevated.comunicacion.deleteMany({ where: { organisationId } }),
      elevated.buzonConectado.deleteMany({ where: { organisationId } }),
      // The audit event is intentionally immutable, so its test tenant cannot be
      // hard-deleted afterwards. Deactivate the two uniquely named tenants.
      elevated.organisation.updateMany({
        where: { id: { in: [organisationId, otherOrganisationId] } },
        data: { isActive: false },
      }),
    ]);
  });

  it('envía cada mensaje una vez, persiste el lote y recoge el resultado', async () => {
    const crear = vi.fn().mockResolvedValue({ id: `msgbatch_${suffix}` });
    const retrieve = vi.fn().mockResolvedValue({ processing_status: 'ended' });
    const apiCrear = {
      messages: { batches: { create: crear, retrieve, results: vi.fn() } },
    } as unknown as Anthropic;

    const creado = await crearLoteHistorico(
      organisationId,
      buzonId,
      { id: 'actor-batch', email: 'actor@example.test', role: 'OWNER' },
      apiCrear,
    );
    expect(creado.total).toBe(1);
    const requests = crear.mock.calls[0]?.[0] as { requests: { custom_id: string }[] };
    expect(requests.requests).toHaveLength(1);
    expect(requests.requests[0]?.custom_id).toMatch(/^c_/);

    const item = await elevated.itemLoteDeteccion.findFirstOrThrow({
      where: { loteId: creado.loteId },
      select: { customId: true },
    });
    async function* resultados() {
      await Promise.resolve();
      yield {
        custom_id: item.customId,
        result: {
          type: 'succeeded',
          message: {
            model: 'claude-opus-5',
            content: [{ type: 'text', text: '{"detecciones":[]}' }],
            usage: { input_tokens: 30, output_tokens: 5 },
          },
        },
      };
    }
    const apiRecoger = {
      messages: {
        batches: {
          create: crear,
          retrieve,
          results: vi.fn().mockResolvedValue(resultados()),
        },
      },
    } as unknown as Anthropic;

    const recogido = await recogerLoteHistorico(
      organisationId,
      creado.loteId,
      { id: 'actor-batch', email: 'actor@example.test', role: 'OWNER' },
      apiRecoger,
    );
    expect(recogido).toEqual({ terminado: true, completados: 1, fallidos: 0 });

    const lote = await elevated.loteDeteccion.findUniqueOrThrow({
      where: { id: creado.loteId },
      select: { estado: true, completados: true, fallidos: true },
    });
    expect(lote).toEqual({ estado: 'COMPLETADO', completados: 1, fallidos: 0 });

    const invisible = await tenantTransaction(otherOrganisationId, (tx) =>
      tx.loteDeteccion.findFirst({ where: { id: creado.loteId } }),
    );
    expect(invisible).toBeNull();
  });
});
