import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { identityClientBecause, tenantTransaction } from '@/lib/db/tenant';
import { CATEGORIAS_RIESGO_POR_DEFECTO } from '@/lib/domain/riesgos/categorias';
import { BANDAS_POR_DEFECTO } from '@/lib/domain/riesgos/matriz';
import { crearAccionCorrectora, revisarRiesgo } from '@/lib/services/ciclo-riesgos';
import {
  actualizarBandasRiesgo,
  crearCategoriaRiesgo,
} from '@/lib/services/configuracion-riesgos';
import { crearRiesgo } from '@/lib/services/riesgos';

describe('ciclo de riesgo completo', () => {
  const elevated = identityClientBecause(
    'integration test creates disposable risk tenants and verifies database invariants',
  );
  const suffix = randomUUID().slice(0, 8);
  let organisationA = '';
  let organisationB = '';
  let riesgoA = '';
  let riesgoB = '';
  let valoracionA = '';

  beforeAll(async () => {
    const [a, b] = await elevated.$transaction([
      elevated.organisation.create({
        data: { name: `Riesgos completos A ${suffix}`, slug: `riesgos-a-${suffix}` },
        select: { id: true },
      }),
      elevated.organisation.create({
        data: { name: `Riesgos completos B ${suffix}`, slug: `riesgos-b-${suffix}` },
        select: { id: true },
      }),
    ]);
    organisationA = a.id;
    organisationB = b.id;

    await Promise.all([
      tenantTransaction(organisationA, (tx) =>
        tx.bandaRiesgo.createMany({
          data: BANDAS_POR_DEFECTO.map((banda, indice) => ({
            organisationId: organisationA,
            nivel: banda.nivel,
            nombre: banda.nombre,
            puntuacionMinima: banda.desde,
            puntuacionMaxima: banda.hasta,
            color: banda.color,
            orden: indice + 1,
          })),
        }),
      ),
      tenantTransaction(organisationB, (tx) =>
        tx.bandaRiesgo.createMany({
          data: BANDAS_POR_DEFECTO.map((banda, indice) => ({
            organisationId: organisationB,
            nivel: banda.nivel,
            nombre: banda.nombre,
            puntuacionMinima: banda.desde,
            puntuacionMaxima: banda.hasta,
            color: banda.color,
            orden: indice + 1,
          })),
        }),
      ),
    ]);

    await Promise.all(
      [organisationA, organisationB].map((organisationId) =>
        tenantTransaction(organisationId, (tx) =>
          tx.categoriaRiesgo.createMany({
            data: CATEGORIAS_RIESGO_POR_DEFECTO.map((categoria, indice) => ({
              organisationId,
              clave: categoria.clave,
              nombre: categoria.nombre,
              color: categoria.color,
              orden: indice + 1,
            })),
          }),
        ),
      ),
    );

    const [categoriaA, categoriaB] = await Promise.all([
      tenantTransaction(organisationA, (tx) =>
        tx.categoriaRiesgo.findFirstOrThrow({
          where: { clave: 'OPERATIVO' },
          select: { id: true },
        }),
      ),
      tenantTransaction(organisationB, (tx) =>
        tx.categoriaRiesgo.findFirstOrThrow({
          where: { clave: 'CONTRACTUAL' },
          select: { id: true },
        }),
      ),
    ]);

    const [aCreado, bCreado] = await Promise.all([
      tenantTransaction(organisationA, (tx) =>
        crearRiesgo(tx, organisationA, {
          categoriaId: categoriaA.id,
          causa: 'La lista de cierre se completa sin una segunda revisión',
          evento: 'puede omitirse una comprobación crítica del servicio',
          consecuencia: 'se incumple el nivel de servicio comprometido',
          probabilidadInherente: 4,
          impactoInherente: 4,
          creadoPorId: 'actor-prueba',
        }),
      ),
      tenantTransaction(organisationB, (tx) =>
        crearRiesgo(tx, organisationB, {
          categoriaId: categoriaB.id,
          causa: 'El parte del otro contrato llega tarde',
          evento: 'puede activarse una penalidad reservada',
          consecuencia: 'se reduce la facturación mensual',
          probabilidadInherente: 3,
          impactoInherente: 4,
          creadoPorId: 'actor-prueba',
        }),
      ),
    ]);
    riesgoA = aCreado.id;
    riesgoB = bCreado.id;
    valoracionA = (
      await elevated.valoracionRiesgo.findFirstOrThrow({
        where: { organisationId: organisationA, riesgoId: riesgoA },
        select: { id: true },
      })
    ).id;
  });

  afterAll(async () => {
    if (!organisationA || !organisationB) return;
    // The history tables deliberately reject ordinary DELETE. The elevated
    // test owner disables user triggers only for this disposable-fixture
    // cleanup; production application credentials cannot do this.
    await elevated.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica');
      const organizaciones = [organisationA, organisationB];
      await tx.accionCorrectora.deleteMany({
        where: { organisationId: { in: organizaciones } },
      });
      await tx.controlRiesgo.deleteMany({
        where: { organisationId: { in: organizaciones } },
      });
      await tx.revisionRiesgo.deleteMany({
        where: { organisationId: { in: organizaciones } },
      });
      await tx.valoracionRiesgo.deleteMany({
        where: { organisationId: { in: organizaciones } },
      });
      await tx.riesgo.deleteMany({ where: { organisationId: { in: organizaciones } } });
      await tx.bandaRiesgo.deleteMany({
        where: { organisationId: { in: organizaciones } },
      });
      await tx.categoriaRiesgo.deleteMany({
        where: { organisationId: { in: organizaciones } },
      });
      await tx.organisation.deleteMany({
        where: { id: { in: organizaciones } },
      });
    });
  });

  it('aplica bandas configurables y conserva la valoración inicial', async () => {
    const [riesgo, valoracion] = await Promise.all([
      elevated.riesgo.findUniqueOrThrow({ where: { id: riesgoA } }),
      elevated.valoracionRiesgo.findUniqueOrThrow({ where: { id: valoracionA } }),
    ]);

    expect(riesgo.proximaRevision).toBeInstanceOf(Date);
    expect(valoracion.puntuacionInherente).toBe(16);
    expect(valoracion.nivelInherente).toBe('MUY_ALTO');
    expect(valoracion.tipo).toBe('INICIAL');
  });

  it('no revela bandas ni valoraciones de otro tenant', async () => {
    const valoracionAjena = await elevated.valoracionRiesgo.findFirstOrThrow({
      where: { organisationId: organisationB, riesgoId: riesgoB },
      select: { id: true },
    });

    const [bandas, riesgo, valoracion] = await tenantTransaction(organisationA, async (tx) =>
      Promise.all([
        tx.bandaRiesgo.count(),
        tx.riesgo.findFirst({ where: { id: riesgoB } }),
        tx.valoracionRiesgo.findFirst({ where: { id: valoracionAjena.id } }),
      ]),
    );

    expect(bandas).toBe(4);
    expect(riesgo).toBeNull();
    expect(valoracion).toBeNull();
  });

  it('guarda revisión, residual e histórico inmutable en una operación', async () => {
    const resultado = await tenantTransaction(organisationA, (tx) =>
      revisarRiesgo(tx, organisationA, {
        riesgoId: riesgoA,
        resultado: 'REVALORADO',
        comentarios: 'El control de doble firma reduce la probabilidad observada.',
        probabilidadResidual: 2,
        impactoResidual: 3,
        proximaRevision: '2026-11-14',
        revisadaPorId: 'actor-prueba',
      }),
    );

    const [riesgo, revisiones, valoraciones] = await Promise.all([
      elevated.riesgo.findUniqueOrThrow({ where: { id: riesgoA } }),
      elevated.revisionRiesgo.findMany({ where: { riesgoId: riesgoA } }),
      elevated.valoracionRiesgo.findMany({
        where: { riesgoId: riesgoA },
        orderBy: { valoradaEn: 'asc' },
      }),
    ]);

    expect(resultado.revalorado).toBe(true);
    expect(riesgo.estado).toBe('EN_TRATAMIENTO');
    expect(riesgo.probabilidadResidual).toBe(2);
    expect(riesgo.impactoResidual).toBe(3);
    expect(revisiones).toHaveLength(1);
    expect(valoraciones).toHaveLength(2);
    expect(valoraciones.at(-1)?.puntuacionResidual).toBe(6);
  });

  it('la base de datos rechaza reescribir o borrar el histórico', async () => {
    await expect(
      elevated.valoracionRiesgo.update({
        where: { id: valoracionA },
        data: { justificacion: 'Intento de reescritura' },
      }),
    ).rejects.toThrow(/sólo inserción/iu);

    await expect(
      elevated.valoracionRiesgo.delete({ where: { id: valoracionA } }),
    ).rejects.toThrow(/sólo inserción/iu);
  });

  it('una acción mantiene un único origen y exige una transición válida', async () => {
    const accion = await tenantTransaction(organisationA, (tx) =>
      crearAccionCorrectora(tx, organisationA, {
        riesgoId: riesgoA,
        titulo: 'Implantar doble firma',
        descripcion: 'Configurar y probar la doble firma en todos los cierres diarios.',
        prioridad: 'ALTA',
        creadoPorId: 'actor-prueba',
      }),
    );

    const guardada = await elevated.accionCorrectora.findUniqueOrThrow({
      where: { id: accion.id },
    });
    expect(guardada.riesgoId).toBe(riesgoA);
    expect(guardada.incidenciaId).toBeNull();

    await expect(
      elevated.accionCorrectora.create({
        data: {
          organisationId: organisationA,
          titulo: 'Sin origen',
          descripcion: 'La restricción se comprueba directamente en PostgreSQL.',
        },
      }),
    ).rejects.toThrow();
  });

  it('personaliza categorías y bandas sin reescribir el histórico', async () => {
    const valoracionAnterior = await elevated.valoracionRiesgo.findUniqueOrThrow({
      where: { id: valoracionA },
      select: { bandas: true, nivelInherente: true },
    });

    const categoria = await tenantTransaction(organisationA, async (tx) => {
      const creada = await crearCategoriaRiesgo(tx, organisationA, {
        clave: 'SUMINISTRO_CRITICO',
        nombre: 'Suministro crítico',
        color: '#2563eb',
        actorId: 'actor-prueba',
      });
      await actualizarBandasRiesgo(tx, [
        { nivel: 'BAJO', nombre: 'Menor', desde: 1, hasta: 3, color: '#64748b' },
        { nivel: 'MEDIO', nombre: 'Tolerable', desde: 4, hasta: 8, color: '#d97706' },
        { nivel: 'ALTO', nombre: 'Prioritario', desde: 9, hasta: 14, color: '#dc2626' },
        { nivel: 'MUY_ALTO', nombre: 'Crítico', desde: 15, hasta: 25, color: '#991b1b' },
      ]);
      return creada;
    });

    const nuevo = await tenantTransaction(organisationA, (tx) =>
      crearRiesgo(tx, organisationA, {
        categoriaId: categoria.id,
        causa: 'Un proveedor único concentra el suministro esencial',
        evento: 'puede interrumpirse la entrega del material operativo',
        consecuencia: 'se incumplen los turnos comprometidos con el órgano',
        probabilidadInherente: 3,
        impactoInherente: 5,
        creadoPorId: 'actor-prueba',
      }),
    );
    const [historica, nueva] = await Promise.all([
      elevated.valoracionRiesgo.findUniqueOrThrow({ where: { id: valoracionA } }),
      elevated.valoracionRiesgo.findFirstOrThrow({ where: { riesgoId: nuevo.id } }),
    ]);

    expect(categoria.nombre).toBe('Suministro crítico');
    expect(nueva.puntuacionInherente).toBe(15);
    expect(nueva.nivelInherente).toBe('MUY_ALTO');
    expect(historica.bandas).toEqual(valoracionAnterior.bandas);
    expect(historica.nivelInherente).toBe(valoracionAnterior.nivelInherente);
  });
});
