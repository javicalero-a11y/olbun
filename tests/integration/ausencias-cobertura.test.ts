import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { coberturaDeContrato, crearAusencia } from '@/lib/services/personal/ausencias';
import { crearAdscripcion, crearPlantillaExigida } from '@/lib/services/personal/adscripciones';
import { crearCategoriaProfesional, crearConvenio } from '@/lib/services/personal/convenios';
import { crearEmpleado } from '@/lib/services/personal/empleados-escritura';
import { identityClientBecause, tenantTransaction } from '@/lib/db/tenant';
import type { FechaCivil } from '@/lib/domain/fecha';

/**
 * Absences against a real Postgres (M12).
 *
 * The arithmetic is unit-tested in the domain module; what needs a database is
 * that the rows are isolated by RLS and that coverage joins assignments to
 * absences correctly once they are actually stored.
 */
describe('ausencias y cobertura real', () => {
  const elevated = identityClientBecause('integration test owns disposable absence tenants');
  const suffix = randomUUID().slice(0, 8);
  const f = (valor: string) => valor as FechaCivil;

  let organisationA = '';
  let organisationB = '';
  let contratoId = '';
  let categoriaId = '';
  let empleadoId = '';
  let ausenciaId = '';

  beforeAll(async () => {
    const [a, b] = await elevated.$transaction([
      elevated.organisation.create({
        data: { name: `Ausencias A ${suffix}`, slug: `aus-a-${suffix}` },
        select: { id: true },
      }),
      elevated.organisation.create({
        data: { name: `Ausencias B ${suffix}`, slug: `aus-b-${suffix}` },
        select: { id: true },
      }),
    ]);
    organisationA = a.id;
    organisationB = b.id;

    await tenantTransaction(organisationA, async (tx) => {
      const poder = await tx.poderAdjudicador.create({
        data: {
          organisationId: organisationA,
          nombre: `Ayuntamiento ${suffix}`,
          tipo: 'AYUNTAMIENTO',
        },
        select: { id: true },
      });

      const contrato = await tx.contrato.create({
        data: {
          organisationId: organisationA,
          poderAdjudicadorId: poder.id,
          numeroExpediente: `AUS-${suffix}`,
          objeto: 'Limpieza viaria',
          tipo: 'SERVICIOS',
          procedimiento: 'ABIERTO',
        },
        select: { id: true },
      });
      contratoId = contrato.id;

      const convenio = await crearConvenio(tx, organisationA, {
        nombre: `Convenio ${suffix}`,
        ambito: 'PROVINCIAL',
        sector: 'Servicios',
        provincia: 'Sevilla',
        codigoBoletin: undefined,
        fechaPublicacion: undefined,
        vigenciaDesde: '2026-01-01',
        vigenciaHasta: undefined,
        enUltraactividad: false,
        urlBoletin: undefined,
        actorId: 'actor-prueba',
      });

      const categoria = await crearCategoriaProfesional(tx, organisationA, {
        convenioId: convenio.id,
        grupo: 'II',
        nivel: '1',
        denominacion: 'Peón',
        grupoCotizacionSS: 10,
        actorId: 'actor-prueba',
      });
      categoriaId = categoria.id;

      const empleado = await crearEmpleado(tx, organisationA, {
        numeroEmpleado: `AUS-${suffix}`,
        nombre: 'Rosa',
        apellidos: 'Vega',
        email: undefined,
        telefono: undefined,
        puesto: undefined,
        estado: 'ACTIVO',
        fechaAlta: '2026-01-01',
        fechaBaja: undefined,
        nif: '00000000T',
        numeroAfiliacionSS: undefined,
        codigoCuentaCotizacion: undefined,
        categoriaId,
        convenioId: convenio.id,
        codigoContratoSEPE: undefined,
        jornadaPorcentaje: 100,
        horasSemanales: 40,
        antiguedadReconocida: '2026-01-01',
        complementoAdPersonam: undefined,
        esSubrogado: false,
        contratoOrigenSubrogacionId: undefined,
        tieneReduccionJornada: false,
        tieneDiscapacidadReconocida: false,
        esRepresentanteTrabajadores: false,
        actorId: 'actor-prueba',
      });
      empleadoId = empleado.id;

      // El pliego exige 40 h/semana de esa categoría; una persona las cubre.
      await crearPlantillaExigida(tx, organisationA, {
        contratoId,
        categoriaId,
        centroTrabajo: 'Centro Norte',
        numeroPersonas: 1,
        horasSemanales: 40,
        fuente: 'PPT',
        clausula: 'Una persona a jornada completa.',
        esVinculante: true,
        actorId: 'actor-prueba',
      });

      await crearAdscripcion(tx, organisationA, {
        empleadoId,
        contratoId,
        categoriaId,
        centroTrabajo: 'Centro Norte',
        horasSemanales: 40,
        porcentajeDedicacion: 100,
        fechaAlta: '2026-01-01',
        esPersonalClave: false,
        turno: 'MANANA',
        actorId: 'actor-prueba',
      });
    });
  });

  it('sin ausencias, la cobertura está completa', async () => {
    const cobertura = await tenantTransaction(organisationA, (tx) =>
      coberturaDeContrato(tx, contratoId, { desde: f('2026-06-01'), hasta: f('2026-06-05') }),
    );

    expect(cobertura.totalExigidas).toBe(40);
    expect(cobertura.totalDisponibles).toBe(40);
    expect(cobertura.porcentaje).toBe(100);
  });

  it('una baja abre un déficit medible en horas', async () => {
    const ausencia = await tenantTransaction(organisationA, (tx) =>
      crearAusencia(
        tx,
        organisationA,
        {
          empleadoId,
          tipo: 'IT_CONTINGENCIA_COMUN',
          fechaInicio: f('2026-06-01'),
          fechaFinPrevista: f('2026-06-02'),
          esRecaida: false,
          actorId: 'actor',
        },
        new Set(),
        f('2026-06-10'),
      ),
    );
    ausenciaId = ausencia.id;

    expect(ausencia.diasNaturales).toBe(2);
    expect(ausencia.diasLaborables).toBe(2);

    const cobertura = await tenantTransaction(organisationA, (tx) =>
      coberturaDeContrato(tx, contratoId, { desde: f('2026-06-01'), hasta: f('2026-06-05') }),
    );

    // Dos de los cinco días laborables: 16 de las 40 horas.
    expect(cobertura.totalDisponibles).toBe(24);
    expect(cobertura.porcentaje).toBe(60);
  });

  it('rechaza una ausencia que se solapa con otra de la misma persona', async () => {
    await expect(
      tenantTransaction(organisationA, (tx) =>
        crearAusencia(
          tx,
          organisationA,
          {
            empleadoId,
            tipo: 'VACACIONES',
            fechaInicio: f('2026-06-02'),
            fechaFinPrevista: f('2026-06-04'),
            esRecaida: false,
            actorId: 'actor',
          },
          new Set(),
          f('2026-06-10'),
        ),
      ),
    ).rejects.toThrow(/ya tiene otra ausencia/);
  });

  it('RLS no revela la ausencia a otro tenant aunque conozca el id', async () => {
    const ajena = await tenantTransaction(organisationB, (tx) =>
      tx.ausencia.findFirst({ where: { id: ausenciaId } }),
    );

    expect(ajena).toBeNull();
  });

  afterAll(async () => {
    await elevated.organisation.deleteMany({
      where: { id: { in: [organisationA, organisationB] } },
    });
  });
});
