import type { PrismaClient } from '@prisma/client';

import { cifrar, indiceCiegoNif } from '../lib/crypto/cifrado-nucleo';
import { precioHoraOrdinaria } from '../lib/domain/personal/salarios';
import {
  APELLIDOS_PERSONAL_DEMO as APELLIDOS,
  CONVENIOS_PERSONAL_DEMO as CONVENIOS,
  EQUIPOS_PERSONAL_DEMO as EQUIPOS,
  NOMBRES_PERSONAL_DEMO as NOMBRES,
} from './personal-demo-datos';

const ACTOR = 'SYSTEM_DEMO';
const FECHA_VIGENCIA = new Date('2026-01-01T00:00:00.000Z');
const LETRAS_NIF = 'TRWAGMYFPDXBNJZSQVHLCKE';

function nifDemo(indice: number): string {
  const numero = 10_000_000 + indice * 7_919;
  return `${String(numero).padStart(8, '0')}${LETRAS_NIF[numero % 23]}`;
}

function enDias(dias: number): Date {
  const fecha = new Date(Date.now() + dias * 86_400_000);
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

export async function sembrarPersonalDemo(
  prisma: PrismaClient,
  organisationId: string,
): Promise<{ empleados: number; certificaciones: number }> {
  const convenios = new Map<string, string>();
  const categorias = new Map<string, string>();

  for (const semilla of CONVENIOS) {
    const previo = await prisma.convenioColectivo.findFirst({
      where: { organisationId, nombre: semilla.nombre },
      select: { id: true },
    });
    const convenio = previo
      ? await prisma.convenioColectivo.update({
          where: { id: previo.id },
          data: { deletedAt: null },
          select: { id: true },
        })
      : await prisma.convenioColectivo.create({
          data: {
            organisationId,
            nombre: semilla.nombre,
            ambito: 'PROVINCIAL',
            sector: semilla.sector,
            provincia: 'Sevilla',
            vigenciaDesde: FECHA_VIGENCIA,
            enUltraactividad: false,
            createdById: ACTOR,
          },
          select: { id: true },
        });
    convenios.set(semilla.clave, convenio.id);

    for (const [clave, grupo, denominacion, grupoSS, base] of semilla.categorias) {
      const previa = await prisma.categoriaProfesional.findFirst({
        where: { organisationId, convenioId: convenio.id, grupo, nivel: clave },
        select: { id: true },
      });
      const categoria = previa
        ? await prisma.categoriaProfesional.update({
            where: { id: previa.id },
            data: { denominacion, grupoCotizacionSS: grupoSS, deletedAt: null },
            select: { id: true },
          })
        : await prisma.categoriaProfesional.create({
            data: {
              organisationId,
              convenioId: convenio.id,
              grupo,
              nivel: clave,
              denominacion,
              grupoCotizacionSS: grupoSS,
              createdById: ACTOR,
            },
            select: { id: true },
          });
      categorias.set(`${semilla.clave}:${clave}`, categoria.id);

      const tabla = await prisma.tablaSalarial.findFirst({
        where: { organisationId, categoriaId: categoria.id, ano: 2026 },
        select: { id: true },
      });
      const datosTabla = {
        convenioId: convenio.id,
        categoriaId: categoria.id,
        ano: 2026,
        salarioBaseMensual: base,
        numeroPagas: 14,
        jornadaAnualHoras: 1_780,
        precioHoraOrdinaria: precioHoraOrdinaria({
          salarioBaseMensual: base,
          numeroPagas: 14,
          jornadaAnualHoras: 1_780,
        }),
        precioHoraExtra: 14.5,
        vigenciaDesde: FECHA_VIGENCIA,
        deletedAt: null,
      };
      if (tabla)
        await prisma.tablaSalarial.update({ where: { id: tabla.id }, data: datosTabla });
      else
        await prisma.tablaSalarial.create({
          data: { organisationId, ...datosTabla, createdById: ACTOR },
        });
    }
  }

  const contratos = await prisma.contrato.findMany({
    where: { organisationId },
    select: { id: true, numeroExpediente: true, fechaInicio: true },
  });
  const contratoPorReferencia = new Map(
    contratos.map((contrato) => [contrato.numeroExpediente, contrato]),
  );
  const tipos = await sembrarTipos(prisma, organisationId);
  let indice = 0;
  let totalCertificaciones = 0;

  for (const [referencia, convenioClave, centro, composicion] of EQUIPOS) {
    const contrato = contratoPorReferencia.get(referencia);
    const convenioId = convenios.get(convenioClave);
    if (!contrato || !convenioId) continue;

    const vinculo = await prisma.contratoConvenio.findFirst({
      where: { organisationId, contratoId: contrato.id, convenioId },
      select: { id: true },
    });
    if (vinculo)
      await prisma.contratoConvenio.update({
        where: { id: vinculo.id },
        data: { esPrincipal: true, deletedAt: null },
      });
    else
      await prisma.contratoConvenio.create({
        data: {
          organisationId,
          contratoId: contrato.id,
          convenioId,
          esPrincipal: true,
          createdById: ACTOR,
        },
      });

    for (const [categoriaClave, asignadas, exigidas] of composicion) {
      const categoriaId = categorias.get(`${convenioClave}:${categoriaClave}`);
      if (!categoriaId) continue;
      await sembrarExigencia(
        prisma,
        organisationId,
        contrato.id,
        categoriaId,
        centro,
        exigidas,
      );

      for (let posicion = 0; posicion < asignadas; posicion += 1) {
        indice += 1;
        const nif = nifDemo(indice);
        const numeroEmpleado = `EMP-${String(indice).padStart(4, '0')}`;
        const nombre = NOMBRES[indice - 1] ?? `Persona ${String(indice)}`;
        const apellidos = APELLIDOS[(indice - 1) % APELLIDOS.length] ?? 'Demo';
        const identificacion = cifrar(
          JSON.stringify({
            nif,
            numeroAfiliacionSS: `41/10${String(indice).padStart(6, '0')}/00`,
            codigoCuentaCotizacion: `41/99${String(indice).padStart(5, '0')}`,
          }),
        );
        const laborales = cifrar(
          JSON.stringify({
            complementoAdPersonam: indice % 9 === 0 ? 85 : undefined,
            tieneDiscapacidadReconocida: false,
          }),
        );
        const empleado = await prisma.empleado.upsert({
          where: { organisationId_numeroEmpleado: { organisationId, numeroEmpleado } },
          update: {
            nombre,
            apellidos,
            estado: 'ACTIVO',
            categoriaId,
            convenioId,
            datosIdentificacionCifrados: identificacion,
            datosLaboralesCifrados: laborales,
            nifHash: indiceCiegoNif(nif),
            deletedAt: null,
          },
          create: {
            organisationId,
            numeroEmpleado,
            nombre,
            apellidos,
            email: `${nombre
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/gu, '')
              .toLowerCase()}.${indice}@demo.olbun.local`,
            puesto: categoriaClave,
            estado: 'ACTIVO',
            fechaAlta: enDias(-760 + indice * 9),
            nifHash: indiceCiegoNif(nif),
            datosIdentificacionCifrados: identificacion,
            datosLaboralesCifrados: laborales,
            categoriaId,
            convenioId,
            codigoContratoSEPE: '100',
            grupoCotizacion: 10,
            jornadaPorcentaje: 100,
            horasSemanales: 40,
            antiguedadReconocida: enDias(-1_100 + indice * 7),
            esSubrogado: referencia !== 'EMV/2025/0042',
            createdById: ACTOR,
          },
          select: { id: true },
        });
        const fechaAlta = contrato.fechaInicio ?? enDias(-365);
        await prisma.adscripcionContrato.upsert({
          where: {
            empleadoId_contratoId_fechaAlta: {
              empleadoId: empleado.id,
              contratoId: contrato.id,
              fechaAlta,
            },
          },
          update: {
            categoriaId,
            centroTrabajo: centro,
            horasSemanales: 40,
            porcentajeDedicacion: 100,
            deletedAt: null,
          },
          create: {
            organisationId,
            empleadoId: empleado.id,
            contratoId: contrato.id,
            categoriaId,
            centroTrabajo: centro,
            horasSemanales: 40,
            porcentajeDedicacion: 100,
            fechaAlta,
            esPersonalClave: posicion === 0,
            turno: posicion % 3 === 0 ? 'MANANA' : posicion % 3 === 1 ? 'TARDE' : 'ROTATIVO',
            createdById: ACTOR,
          },
        });
        totalCertificaciones += await sembrarCertificados(
          prisma,
          organisationId,
          empleado.id,
          tipos,
          indice,
        );
      }
    }
  }

  await sembrarPersonasIncidencia(prisma, organisationId);
  return { empleados: indice, certificaciones: totalCertificaciones };
}

async function sembrarTipos(prisma: PrismaClient, organisationId: string) {
  const semillas = [
    ['PRL_PUESTO', 'PRL específica del puesto', 30, true],
    ['PRIMEROS_AUXILIOS', 'Primeros auxilios', 60, true],
    ['FITOSANITARIOS', 'Aplicador de productos fitosanitarios', 90, false],
  ] as const;
  const resultado = new Map<string, string>();
  for (const [codigo, nombre, diasAviso, esObligatoria] of semillas) {
    const tipo = await prisma.tipoCertificacion.upsert({
      where: { organisationId_codigo: { organisationId, codigo } },
      update: { nombre, diasAviso, esObligatoria, isActive: true, deletedAt: null },
      create: {
        organisationId,
        codigo,
        nombre,
        diasAviso,
        esObligatoria,
        isActive: true,
        createdById: ACTOR,
      },
      select: { id: true },
    });
    resultado.set(codigo, tipo.id);
  }
  return resultado;
}

async function sembrarExigencia(
  prisma: PrismaClient,
  organisationId: string,
  contratoId: string,
  categoriaId: string,
  centro: string,
  personas: number,
) {
  const previa = await prisma.plantillaExigida.findFirst({
    where: { organisationId, contratoId, categoriaId, centroTrabajo: centro },
    select: { id: true },
  });
  const datos = {
    numeroPersonas: personas,
    horasSemanales: personas * 40,
    fuente: 'PPT' as const,
    clausula: `Cláusula demo: dotación mínima de ${String(personas)} personas en ${centro}.`,
    esVinculante: true,
    deletedAt: null,
  };
  if (previa) await prisma.plantillaExigida.update({ where: { id: previa.id }, data: datos });
  else
    await prisma.plantillaExigida.create({
      data: {
        organisationId,
        contratoId,
        categoriaId,
        centroTrabajo: centro,
        ...datos,
        createdById: ACTOR,
      },
    });
}

async function sembrarCertificados(
  prisma: PrismaClient,
  organisationId: string,
  empleadoId: string,
  tipos: Map<string, string>,
  indice: number,
): Promise<number> {
  const tipoId = tipos.get('PRL_PUESTO');
  if (!tipoId) return 0;
  const dias = indice % 12 === 0 ? -25 : indice % 7 === 0 ? 18 : 240 + indice;
  const previa = await prisma.certificacionEmpleado.findFirst({
    where: { organisationId, empleadoId, tipoId },
    select: { id: true },
  });
  const datos = {
    referenciaCifrada: cifrar(`PRL-DEMO-${String(indice).padStart(4, '0')}`),
    emitidaPor: 'Servicio de prevención ajeno (demo)',
    fechaEmision: enDias(dias - 365),
    fechaCaducidad: enDias(dias),
    estado:
      dias < 0
        ? ('CADUCADA' as const)
        : dias <= 30
          ? ('PROXIMA_A_CADUCAR' as const)
          : ('VALIDA' as const),
    verificadaPorId: ACTOR,
    verificadaEn: new Date(),
    deletedAt: null,
  };
  if (previa)
    await prisma.certificacionEmpleado.update({ where: { id: previa.id }, data: datos });
  else
    await prisma.certificacionEmpleado.create({
      data: { organisationId, empleadoId, tipoId, ...datos, createdById: ACTOR },
    });
  return 1;
}

async function sembrarPersonasIncidencia(
  prisma: PrismaClient,
  organisationId: string,
): Promise<void> {
  const incidencia = await prisma.incidencia.findFirst({
    where: { organisationId, referencia: 'INC-2026-0008' },
    select: { id: true },
  });
  if (!incidencia) return;
  await prisma.incidencia.update({
    where: { id: incidencia.id },
    data: {
      personasImplicadas: {
        version: 1,
        cifrado: cifrar(
          JSON.stringify({
            texto:
              'Persona trabajadora EMP-0046 — lesión leve en tobillo. Testigo: responsable de centro. Datos íntegramente ficticios.',
          }),
        ),
      },
    },
  });
}
