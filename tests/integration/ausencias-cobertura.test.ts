import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';

import { coberturaDeContrato, crearAusencia } from '@/lib/services/personal/ausencias';
import { evaluarEstadoDelSistema } from '@/lib/services/detecciones/sistema';
import { planificadorDeContrato } from '@/lib/services/personal/planificador';
import {
  bolsaAnual,
  diasSinRegistro,
  registrarJornada,
  verificarJornadaDe,
} from '@/lib/services/jornada/registro';
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
          // El motor sólo mira contratos vivos: uno en licitación no tiene a
          // nadie adscrito y no puede estar infradotado.
          estado: 'EN_EJECUCION',
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

  it('el déficit llega a la cola de detecciones como aviso de sistema', async () => {
    // La baja de la prueba anterior deja el contrato por debajo del pliego.
    // Ese cálculo tiene que aparecer en la misma cola que lo detectado en el
    // correo, con la misma revisión humana y sin abrir nada por su cuenta.
    const resultado = await tenantTransaction(organisationA, (tx) =>
      evaluarEstadoDelSistema(tx, organisationA, f('2026-06-05')),
    );

    expect(resultado.creadas).toBeGreaterThan(0);

    const deteccion = await tenantTransaction(organisationA, (tx) =>
      tx.deteccion.findFirst({
        where: { contratoId, tipo: 'INFRADOTACION_PLIEGO' },
        select: {
          origen: true,
          estado: true,
          confianza: true,
          comunicacionId: true,
          datosExtraidos: true,
          extractos: true,
        },
      }),
    );

    expect(deteccion?.origen).toBe('SISTEMA');
    // Nace en la cola, no convertida: el motor propone y decide una persona.
    expect(deteccion?.estado).toBe('NUEVA');
    // Es aritmética, no inferencia.
    expect(deteccion?.confianza).toBe(1);
    // Sin mensaje detrás y sin cita que verificar: la prueba es el cálculo.
    expect(deteccion?.comunicacionId).toBeNull();
    expect(deteccion?.extractos).toEqual([]);
    expect(JSON.stringify(deteccion?.datosExtraidos)).toContain('deficitHoras');
  });

  it('reevaluar refresca lo pendiente y no resucita lo descartado', async () => {
    const antes = await tenantTransaction(organisationA, (tx) =>
      tx.deteccion.count({ where: { contratoId, tipo: 'INFRADOTACION_PLIEGO' } }),
    );

    // Repetir no apila copias.
    const segunda = await tenantTransaction(organisationA, (tx) =>
      evaluarEstadoDelSistema(tx, organisationA, f('2026-06-05')),
    );
    expect(segunda.creadas).toBe(0);
    expect(segunda.actualizadas).toBeGreaterThan(0);

    const despues = await tenantTransaction(organisationA, (tx) =>
      tx.deteccion.count({ where: { contratoId, tipo: 'INFRADOTACION_PLIEGO' } }),
    );
    expect(despues).toBe(antes);

    // Y una vez que alguien lo descarta, no vuelve: repreguntar algo ya
    // decidido enseña a la gente a cerrar la cola sin leerla.
    await tenantTransaction(organisationA, (tx) =>
      tx.deteccion.updateMany({
        where: { contratoId, tipo: 'INFRADOTACION_PLIEGO' },
        data: { estado: 'DESCARTADA' },
      }),
    );

    const tercera = await tenantTransaction(organisationA, (tx) =>
      evaluarEstadoDelSistema(tx, organisationA, f('2026-06-05')),
    );

    expect(tercera.creadas).toBe(0);
    expect(tercera.omitidasPorDescarte).toBeGreaterThan(0);

    const sigueDescartada = await tenantTransaction(organisationA, (tx) =>
      tx.deteccion.findFirst({
        where: { contratoId, tipo: 'INFRADOTACION_PLIEGO' },
        select: { estado: true },
      }),
    );
    expect(sigueDescartada?.estado).toBe('DESCARTADA');
  });

  it('el planificador enseña la semana de la baja y deja el resto cubierto', async () => {
    // La rejilla es la vista de planificación de la misma verdad: donde la
    // cobertura dice «faltan horas en junio», el planificador dice en qué
    // semana concreta y por qué.
    const plan = await tenantTransaction(organisationA, (tx) =>
      planificadorDeContrato(tx, contratoId, {
        desde: f('2026-06-01'),
        hasta: f('2026-06-14'),
      }),
    );

    expect(plan.sinPlantilla).toBe(false);
    expect(plan.semanas).toHaveLength(2);
    expect(plan.filas).toHaveLength(1);

    const fila = plan.filas[0];
    expect(fila?.nombre).toContain('Vega');

    // Semana del 1 de junio: la baja de dos días se lleva 16 de las 40 horas.
    expect(fila?.celdas[0]?.comprometidas).toBe(40);
    expect(fila?.celdas[0]?.ausentes).toBe(16);
    expect(fila?.celdas[0]?.disponibles).toBe(24);
    expect(fila?.celdas[0]?.estado).toBe('AUSENTE');
    expect(fila?.celdas[0]?.motivos).toContain('IT por contingencia común');

    // La semana siguiente no arrastra nada.
    expect(fila?.celdas[1]?.estado).toBe('CUBIERTO');
    expect(fila?.celdas[1]?.disponibles).toBe(40);
    expect(fila?.tieneSobreasignacion).toBe(false);
  });

  it('sin nadie adscrito lo dice, en vez de enseñar una rejilla vacía', async () => {
    const otro = await tenantTransaction(organisationA, async (tx) => {
      const poder = await tx.poderAdjudicador.findFirst({ select: { id: true } });
      const contrato = await tx.contrato.create({
        data: {
          organisationId: organisationA,
          poderAdjudicadorId: poder?.id ?? '',
          numeroExpediente: `VACIO-${suffix}`,
          objeto: 'Contrato sin plantilla',
          tipo: 'SERVICIOS',
          procedimiento: 'ABIERTO',
          estado: 'EN_EJECUCION',
        },
        select: { id: true },
      });
      return contrato.id;
    });

    const plan = await tenantTransaction(organisationA, (tx) =>
      planificadorDeContrato(tx, otro, { desde: f('2026-06-01'), hasta: f('2026-06-14') }),
    );

    expect(plan.sinPlantilla).toBe(true);
    expect(plan.filas).toEqual([]);
    // Y no se inventa una proyección sobre cero horas.
    expect(plan.proyeccion.fiable).toBe(false);
  });

  it('la jornada se encadena y la cadena se puede verificar', async () => {
    await tenantTransaction(organisationA, async (tx) => {
      await registrarJornada(tx, organisationA, {
        empleadoId,
        fecha: f('2026-03-02'),
        horaEntrada: '08:00',
        horaSalida: '16:00',
        pausas: [],
        horasOrdinariasPactadas: 8,
        esFestivo: false,
        origen: 'TERMINAL_FICHAJE',
        actorId: 'actor-prueba',
      });

      await registrarJornada(tx, organisationA, {
        empleadoId,
        fecha: f('2026-03-03'),
        horaEntrada: '08:00',
        horaSalida: '18:00',
        pausas: [{ desde: '12:00', hasta: '12:30' }],
        horasOrdinariasPactadas: 8,
        esFestivo: false,
        origen: 'TERMINAL_FICHAJE',
        actorId: 'actor-prueba',
      });
    });

    const verificacion = await tenantTransaction(organisationA, (tx) =>
      verificarJornadaDe(tx, empleadoId),
    );

    expect(verificacion.intacta).toBe(true);
    expect(verificacion.eslabones).toBe(2);
  });

  it('ni la aplicación ni nadie puede reescribir un registro de jornada', async () => {
    // El valor probatorio depende de que no se pueda reescribir. «La
    // aplicación no lo hace» no es una garantía enseñable a la ITSS: lo
    // impiden un disparador y la falta de permiso, y las dos cosas se
    // comprueban aquí porque la primera versión de esto no funcionaba —
    // ALTER DEFAULT PRIVILEGES ya había concedido UPDATE y DELETE sobre
    // cualquier tabla futura, así que conceder menos no quitaba nada.
    const registro = await tenantTransaction(organisationA, (tx) =>
      tx.registroJornada.findFirst({ select: { id: true } }),
    );

    await expect(
      tenantTransaction(organisationA, (tx) =>
        tx.registroJornada.update({
          where: { id: registro?.id ?? '' },
          data: { horasExtra: 99 },
        }),
      ),
    ).rejects.toThrow();

    await expect(
      tenantTransaction(organisationA, (tx) =>
        tx.registroJornada.delete({ where: { id: registro?.id ?? '' } }),
      ),
    ).rejects.toThrow();

    // Y sigue ahí: el intento no se llevó nada por delante.
    const despues = await tenantTransaction(organisationA, (tx) => tx.registroJornada.count());
    expect(despues).toBe(2);
  });

  it('la bolsa anual suma las horas extra y avisa antes del límite', async () => {
    // El 3 de marzo se trabajaron 9,5 h con 8 pactadas: 1,5 extra.
    const resumen = await tenantTransaction(organisationA, (tx) =>
      bolsaAnual(tx, empleadoId, 2026),
    );

    expect(resumen.horasExtraDelAnio).toBe(1.5);
    expect(resumen.bolsa.estado).toBe('HOLGADA');
    expect(resumen.bolsa.restantes).toBe(78.5);
  });

  it('los días sin registro son la infracción, y se listan', async () => {
    const faltan = await tenantTransaction(organisationA, (tx) =>
      diasSinRegistro(tx, empleadoId, [f('2026-03-02'), f('2026-03-03'), f('2026-03-04')]),
    );

    expect(faltan).toEqual(['2026-03-04']);
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
