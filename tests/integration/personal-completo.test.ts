import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { descifrarObjeto } from '@/lib/crypto/datos-personales';
import { identityClientBecause, tenantTransaction } from '@/lib/db/tenant';
import {
  sembrarTiposCertificacion,
  TIPOS_CERTIFICACION_POR_DEFECTO,
} from '@/lib/services/personal/certificaciones';
import { crearAdscripcion, crearPlantillaExigida } from '@/lib/services/personal/adscripciones';
import { crearCertificacionEmpleado } from '@/lib/services/personal/certificaciones';
import {
  crearCategoriaProfesional,
  crearConvenio,
  crearTablaSalarial,
} from '@/lib/services/personal/convenios';
import { crearEmpleado } from '@/lib/services/personal/empleados-escritura';
import { guardarPersonasImplicadas } from '@/lib/services/personal/incidencias-sensibles';
import { crearIncidencia } from '@/lib/services/riesgos';

describe('personal, convenio y adscripción completos', () => {
  const elevated = identityClientBecause('integration test owns disposable personnel tenants');
  const suffix = randomUUID().slice(0, 8);
  /** `createdById` no tiene relación declarada, así que basta una cadena. */
  const actorDePrueba = `actor-${suffix}`;
  let organisationA = '';
  let organisationB = '';
  let contratoId = '';
  let convenioId = '';
  let categoriaId = '';
  let empleadoId = '';
  let tipoId = '';

  beforeAll(async () => {
    const [a, b] = await elevated.$transaction([
      elevated.organisation.create({
        data: { name: `Personal A ${suffix}`, slug: `personal-a-${suffix}` },
        select: { id: true },
      }),
      elevated.organisation.create({
        data: { name: `Personal B ${suffix}`, slug: `personal-b-${suffix}` },
        select: { id: true },
      }),
    ]);
    organisationA = a.id;
    organisationB = b.id;

    contratoId = await tenantTransaction(organisationA, async (tx) => {
      const poder = await tx.poderAdjudicador.create({
        data: {
          organisationId: organisationA,
          nombre: `Ayuntamiento prueba ${suffix}`,
          tipo: 'AYUNTAMIENTO',
        },
        select: { id: true },
      });
      const contrato = await tx.contrato.create({
        data: {
          organisationId: organisationA,
          poderAdjudicadorId: poder.id,
          numeroExpediente: `PER-${suffix}`,
          objeto: 'Servicio de integración de personal',
          tipo: 'SERVICIOS',
          procedimiento: 'ABIERTO',
        },
        select: { id: true },
      });
      return contrato.id;
    });

    await tenantTransaction(organisationA, async (tx) => {
      const convenio = await crearConvenio(tx, organisationA, {
        nombre: `Convenio de prueba ${suffix}`,
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
      convenioId = convenio.id;
      const categoria = await crearCategoriaProfesional(tx, organisationA, {
        convenioId,
        grupo: 'II',
        nivel: '1',
        denominacion: 'Oficial de servicio',
        grupoCotizacionSS: 8,
        actorId: 'actor-prueba',
      });
      categoriaId = categoria.id;
      await crearTablaSalarial(tx, organisationA, {
        convenioId,
        categoriaId,
        ano: 2026,
        salarioBaseMensual: 1_450,
        numeroPagas: 14,
        jornadaAnualHoras: 1_780,
        vigenciaDesde: '2026-01-01',
        actorId: 'actor-prueba',
      });
      const empleado = await crearEmpleado(tx, organisationA, {
        numeroEmpleado: `EMP-${suffix}`,
        nombre: 'Persona',
        apellidos: 'Protegida Demo',
        email: undefined,
        telefono: undefined,
        puesto: undefined,
        estado: 'ACTIVO',
        fechaAlta: '2026-01-10',
        fechaBaja: undefined,
        nif: '12345678Z',
        numeroAfiliacionSS: '41/1012345678',
        codigoCuentaCotizacion: '41/9912345',
        categoriaId,
        convenioId,
        codigoContratoSEPE: undefined,
        jornadaPorcentaje: 100,
        horasSemanales: 40,
        antiguedadReconocida: '2025-02-01',
        complementoAdPersonam: 75,
        esSubrogado: true,
        contratoOrigenSubrogacionId: undefined,
        tieneReduccionJornada: false,
        tieneDiscapacidadReconocida: false,
        esRepresentanteTrabajadores: false,
        actorId: 'actor-prueba',
      });
      empleadoId = empleado.id;
      const tipo = await tx.tipoCertificacion.create({
        data: {
          organisationId: organisationA,
          codigo: `PRL_${suffix}`,
          nombre: 'PRL del puesto',
          diasAviso: 30,
          esObligatoria: true,
        },
        select: { id: true },
      });
      tipoId = tipo.id;
    });
  });

  afterAll(async () => {
    if (!organisationA || !organisationB) return;
    const ids = [organisationA, organisationB];
    await elevated.certificacionEmpleado.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.adscripcionContrato.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.plantillaExigida.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.empleado.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.tipoCertificacion.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.tablaSalarial.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.categoriaProfesional.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.contratoConvenio.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.convenioColectivo.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.incidencia.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.contrato.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.poderAdjudicador.deleteMany({ where: { organisationId: { in: ids } } });
    await elevated.organisation.deleteMany({ where: { id: { in: ids } } });
  });

  it('mantiene identificadores y retribución fuera del texto claro de la base', async () => {
    const empleado = await elevated.empleado.findUniqueOrThrow({ where: { id: empleadoId } });
    expect(empleado.nifHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(empleado.datosIdentificacionCifrados).toMatch(/^v1\./u);
    expect(empleado.datosIdentificacionCifrados).not.toContain('12345678Z');
    expect(empleado.datosLaboralesCifrados).not.toContain('75');
    expect(
      descifrarObjeto<{ nif: string }>(empleado.datosIdentificacionCifrados ?? ''),
    ).toEqual(expect.objectContaining({ nif: '12345678Z' }));
  });

  it('calcula y versiona la hora ordinaria desde la tabla publicada', async () => {
    const tabla = await elevated.tablaSalarial.findFirstOrThrow({ where: { categoriaId } });
    expect(Number(tabla.precioHoraOrdinaria)).toBe(11.4045);
    expect(tabla.ano).toBe(2026);
  });

  it('crea la cobertura base y bloquea una sobreasignación superior al 150%', async () => {
    await tenantTransaction(organisationA, async (tx) => {
      await crearPlantillaExigida(tx, organisationA, {
        contratoId,
        categoriaId,
        centroTrabajo: 'Centro de prueba',
        numeroPersonas: 1,
        horasSemanales: 40,
        fuente: 'PPT',
        clausula: 'La dotación mínima será de una persona a jornada completa.',
        esVinculante: true,
        actorId: 'actor-prueba',
      });
      await crearAdscripcion(tx, organisationA, {
        empleadoId,
        contratoId,
        categoriaId,
        centroTrabajo: 'Centro de prueba',
        horasSemanales: 40,
        porcentajeDedicacion: 100,
        fechaAlta: '2026-02-01',
        esPersonalClave: true,
        turno: 'MANANA',
        actorId: 'actor-prueba',
      });
    });

    await expect(
      tenantTransaction(organisationA, (tx) =>
        crearAdscripcion(tx, organisationA, {
          empleadoId,
          contratoId,
          categoriaId,
          centroTrabajo: 'Otro centro',
          horasSemanales: 24,
          porcentajeDedicacion: 60,
          fechaAlta: '2026-03-01',
          esPersonalClave: false,
          turno: 'TARDE',
          actorId: 'actor-prueba',
        }),
      ),
    ).rejects.toThrow(/150%/u);
  });

  it('calcula la caducidad en día civil al registrar un certificado', async () => {
    const certificado = await tenantTransaction(organisationA, (tx) =>
      crearCertificacionEmpleado(tx, organisationA, 'Europe/Madrid', {
        empleadoId,
        tipoId,
        referencia: 'PRL-123-PRUEBA',
        fechaEmision: '2025-09-01',
        fechaCaducidad: '2026-08-20',
        actorId: 'actor-prueba',
      }),
    );
    expect(certificado.estado).toBe('PROXIMA_A_CADUCAR');
    const persistido = await elevated.certificacionEmpleado.findUniqueOrThrow({
      where: { id: certificado.id },
    });
    expect(persistido.referenciaCifrada).toMatch(/^v1\./u);
    expect(persistido.referenciaCifrada).not.toContain('PRL-123-PRUEBA');
  });

  it('cifra también las personas implicadas en una incidencia', async () => {
    const incidencia = await tenantTransaction(organisationA, (tx) =>
      crearIncidencia(tx, organisationA, {
        tipo: 'ACCIDENTE',
        gravedad: 'MODERADA',
        fechaHecho: new Date('2026-08-10T00:00:00.000Z'),
        descripcion: 'Una persona sufrió una torcedura durante la prueba de integración.',
        creadoPorId: 'actor-prueba',
      }),
    );
    await tenantTransaction(organisationA, (tx) =>
      guardarPersonasImplicadas(tx, incidencia.id, 'Nombre especialmente protegido'),
    );
    const guardada = await elevated.incidencia.findUniqueOrThrow({
      where: { id: incidencia.id },
    });
    expect(JSON.stringify(guardada.personasImplicadas)).not.toContain(
      'Nombre especialmente protegido',
    );
    expect(JSON.stringify(guardada.personasImplicadas)).toContain('v1.');
  });

  it('siembra los tipos de certificación en cada organización, no sólo en la primera', async () => {
    // El alta corre sobre el cliente elevado, que no filtra por RLS. La
    // comprobación de «¿ya existe este código?» se hacía sin organización, así
    // que encontraba el código de otra empresa y no sembraba nada: la segunda
    // organización y todas las siguientes se quedaban sin tipos y no podían
    // registrar ni un certificado. Dos organizaciones es el número mínimo que
    // distingue las dos versiones.
    await elevated.$transaction(async (tx) => {
      await sembrarTiposCertificacion(tx, organisationA, actorDePrueba);
      await sembrarTiposCertificacion(tx, organisationB, actorDePrueba);
    });

    const codigosDe = (organisationId: string) =>
      tenantTransaction(organisationId, (tx) =>
        tx.tipoCertificacion.findMany({ select: { codigo: true } }),
      ).then((filas) => filas.map((fila) => fila.codigo));

    const esperados = TIPOS_CERTIFICACION_POR_DEFECTO.map((tipo) => tipo.codigo);
    const [enA, enB] = await Promise.all([codigosDe(organisationA), codigosDe(organisationB)]);

    // Cada organización tiene el catálogo completo. Se comparan los códigos y
    // no el total, porque A ha creado además tipos propios en otras pruebas.
    for (const codigo of esperados) {
      expect(enA).toContain(codigo);
      expect(enB).toContain(codigo);
    }

    // Y es idempotente: repetirlo no duplica.
    await elevated.$transaction(async (tx) => {
      await sembrarTiposCertificacion(tx, organisationB, actorDePrueba);
    });

    expect((await codigosDe(organisationB)).length).toBe(enB.length);
  });

  it('RLS no revela empleados a otro tenant aunque conozca el id', async () => {
    const ajeno = await tenantTransaction(organisationB, (tx) =>
      tx.empleado.findFirst({ where: { id: empleadoId } }),
    );
    expect(ajeno).toBeNull();
  });
});
