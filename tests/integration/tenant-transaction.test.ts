import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { identityClientBecause, tenantTransaction } from '@/lib/db/tenant';

/**
 * Regression suite for the transaction boundary behind every server action.
 * A unit mock cannot prove `set_config` and the writes share a Postgres
 * transaction, so this deliberately uses the local/CI database.
 */
describe('tenantTransaction', () => {
  const elevated = identityClientBecause(
    'integration test creates and removes isolated tenants',
  );
  const suffix = randomUUID().slice(0, 8);
  let organisationA = '';
  let organisationB = '';

  beforeAll(async () => {
    const [a, b] = await elevated.$transaction([
      elevated.organisation.create({
        data: { name: `Tenant transacción A ${suffix}`, slug: `tx-a-${suffix}` },
        select: { id: true },
      }),
      elevated.organisation.create({
        data: { name: `Tenant transacción B ${suffix}`, slug: `tx-b-${suffix}` },
        select: { id: true },
      }),
    ]);
    organisationA = a.id;
    organisationB = b.id;
  });

  afterAll(async () => {
    if (!organisationA || !organisationB) return;
    await elevated.team.deleteMany({
      where: { organisationId: { in: [organisationA, organisationB] } },
    });
    await elevated.organisation.deleteMany({
      where: { id: { in: [organisationA, organisationB] } },
    });
  });

  it('sobrescribe un organisationId ajeno dentro de la transacción', async () => {
    const equipo = await tenantTransaction(organisationA, (tx) =>
      tx.team.create({
        data: {
          organisationId: organisationB,
          name: `Equipo ligado ${suffix}`,
        },
      }),
    );

    expect(equipo.organisationId).toBe(organisationA);
  });

  it('no puede leer una fila de otro tenant aunque conozca su id', async () => {
    const ajeno = await elevated.team.create({
      data: { organisationId: organisationB, name: `Equipo ajeno ${suffix}` },
    });

    const visible = await tenantTransaction(organisationA, (tx) =>
      tx.team.findFirst({ where: { id: ajeno.id } }),
    );

    expect(visible).toBeNull();
  });

  it('revierte juntos la mutación y todo lo que ocurra después', async () => {
    const nombre = `Equipo que debe desaparecer ${suffix}`;

    await expect(
      tenantTransaction(organisationA, async (tx) => {
        await tx.team.create({ data: { organisationId: organisationB, name: nombre } });
        throw new Error('fallo posterior simulado');
      }),
    ).rejects.toThrow('fallo posterior simulado');

    const persistido = await elevated.team.findFirst({
      where: { organisationId: organisationA, name: nombre },
    });
    expect(persistido).toBeNull();
  });
});
