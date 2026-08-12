import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { MODELOS_CON_TENANT } from './tenant';

/**
 * A model that carries `organisationId` but is missing from the scoped client's
 * list is silently outside the isolation guarantee — its queries go unfiltered
 * and rely on row-level security alone.
 *
 * This reads the generated schema rather than a hand-kept list, so adding a
 * tenant-owned model and forgetting to register it fails here instead of
 * leaking in production.
 */
describe('cobertura del cliente con ámbito de organización', () => {
  const modelosConOrganisationId = Prisma.dmmf.datamodel.models
    .filter((modelo) => modelo.fields.some((campo) => campo.name === 'organisationId'))
    .map((modelo) => modelo.name);

  it('encuentra los modelos multi-tenant en el esquema', () => {
    expect(modelosConOrganisationId.length).toBeGreaterThan(0);
  });

  it('todos los modelos con organisationId están registrados en el DAL', () => {
    const sinRegistrar = modelosConOrganisationId.filter(
      (nombre) => !MODELOS_CON_TENANT.has(nombre),
    );

    expect(
      sinRegistrar,
      `Modelos con organisationId fuera de TENANT_OWNED en lib/db/tenant.ts: ${sinRegistrar.join(', ')}`,
    ).toEqual([]);
  });

  it('no registra modelos que no existen o no son multi-tenant', () => {
    const sobrantes = [...MODELOS_CON_TENANT].filter(
      (nombre) => !modelosConOrganisationId.includes(nombre),
    );

    expect(sobrantes, `Registrados sin organisationId: ${sobrantes.join(', ')}`).toEqual([]);
  });
});
