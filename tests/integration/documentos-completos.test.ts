import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { identityClientBecause, tenantTransaction } from '@/lib/db/tenant';
import { buscarIdsDocumento } from '@/lib/services/busqueda-documentos';
import {
  cambiarBloqueoLegal,
  enviarAPapelera,
  restaurarDesdePapelera,
} from '@/lib/services/gestion-documentos';

describe('ciclo documental completo', () => {
  const elevated = identityClientBecause('integration test owns disposable document tenants');
  const suffix = randomUUID().slice(0, 8);
  let organisationId = '';
  let otraOrganisationId = '';
  let documentoId = '';

  beforeAll(async () => {
    const [organizacion, otra] = await elevated.$transaction([
      elevated.organisation.create({
        data: { name: `Documentos ${suffix}`, slug: `docs-${suffix}` },
        select: { id: true },
      }),
      elevated.organisation.create({
        data: { name: `Documentos ajenos ${suffix}`, slug: `docs-otros-${suffix}` },
        select: { id: true },
      }),
    ]);
    organisationId = organizacion.id;
    otraOrganisationId = otra.id;

    documentoId = await tenantTransaction(organisationId, async (tx) => {
      const documento = await tx.documento.create({
        data: { organisationId, nombre: 'Resolución de penalidad', createdById: 'actor-test' },
        select: { id: true },
      });
      await tx.versionDocumento.create({
        data: {
          organisationId,
          documentoId: documento.id,
          numero: 1,
          nombre: 'resolucion.pdf',
          mimeType: 'application/pdf',
          tamano: 42,
          sha256: 'a'.repeat(64),
          storageKey: `${organisationId}/aa/${'a'.repeat(64)}`,
          estadoAnalisis: 'LIMPIO',
          estadoIndexacion: 'EXTRAIDO',
          textoExtraido: 'Se acuerda penalidad por incumplimiento grave del servicio.',
        },
      });
      return documento.id;
    });

    await tenantTransaction(otraOrganisationId, async (tx) => {
      const documento = await tx.documento.create({
        data: {
          organisationId: otraOrganisationId,
          nombre: 'Documento ajeno con penalidad',
        },
      });
      await tx.versionDocumento.create({
        data: {
          organisationId: otraOrganisationId,
          documentoId: documento.id,
          numero: 1,
          nombre: 'ajeno.txt',
          mimeType: 'text/plain',
          tamano: 8,
          sha256: 'b'.repeat(64),
          storageKey: `${otraOrganisationId}/bb/${'b'.repeat(64)}`,
          estadoAnalisis: 'LIMPIO',
          estadoIndexacion: 'EXTRAIDO',
          textoExtraido: 'penalidad secreta de otro tenant',
        },
      });
    });
  });

  afterAll(async () => {
    if (!organisationId || !otraOrganisationId) return;
    await elevated.versionDocumento.deleteMany({
      where: { organisationId: { in: [organisationId, otraOrganisationId] } },
    });
    await elevated.documento.deleteMany({
      where: { organisationId: { in: [organisationId, otraOrganisationId] } },
    });
    await elevated.organisation.deleteMany({
      where: { id: { in: [organisationId, otraOrganisationId] } },
    });
  });

  it('busca con stemming español sin revelar coincidencias de otro tenant', async () => {
    const resultados = await buscarIdsDocumento(organisationId, 'incumplimientos penalidades');
    expect(resultados).toContain(documentoId);

    const soloAjeno = await buscarIdsDocumento(organisationId, 'secreta otro tenant');
    expect(soloAjeno).toEqual([]);
  });

  it('el bloqueo impide borrar y la papelera conserva/restaura versiones', async () => {
    await tenantTransaction(organisationId, (tx) =>
      cambiarBloqueoLegal(
        tx,
        documentoId,
        'actor-test',
        true,
        'Evidencia esencial del recurso abierto.',
      ),
    );

    await expect(
      tenantTransaction(organisationId, (tx) =>
        enviarAPapelera(tx, documentoId, 'actor-test', 'Documento duplicado en revisión.'),
      ),
    ).rejects.toThrow(/bloqueo legal/iu);

    await tenantTransaction(organisationId, (tx) =>
      cambiarBloqueoLegal(
        tx,
        documentoId,
        'actor-test',
        false,
        'El procedimiento finalizó con resolución firme.',
      ),
    );
    await tenantTransaction(organisationId, (tx) =>
      enviarAPapelera(
        tx,
        documentoId,
        'actor-test',
        'Duplicado confirmado por administración.',
      ),
    );
    expect(await buscarIdsDocumento(organisationId, 'penalidad')).not.toContain(documentoId);

    await tenantTransaction(organisationId, (tx) =>
      restaurarDesdePapelera(tx, documentoId, 'actor-test'),
    );
    expect(await buscarIdsDocumento(organisationId, 'penalidad')).toContain(documentoId);

    const restaurado = await elevated.documento.findUniqueOrThrow({
      where: { id: documentoId },
      select: { deletedAt: true, restoredAt: true, versiones: { select: { id: true } } },
    });
    expect(restaurado.deletedAt).toBeNull();
    expect(restaurado.restoredAt).toBeInstanceOf(Date);
    expect(restaurado.versiones).toHaveLength(1);
  });
});
