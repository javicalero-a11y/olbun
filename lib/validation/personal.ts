import { z } from 'zod';

import { esFechaCivil } from '@/lib/domain/fecha';
import { esNifONieValido, normalizarNif } from '@/lib/domain/personal/identificadores';

export const AMBITOS_CONVENIO = [
  'ESTATAL',
  'AUTONOMICO',
  'PROVINCIAL',
  'EMPRESA',
  'CENTRO',
] as const;
export const ESTADOS_EMPLEADO = ['ACTIVO', 'EXCEDENCIA', 'BAJA', 'FINALIZADO'] as const;
export const FUENTES_PLANTILLA = ['PCAP', 'PPT', 'OFERTA', 'MODIFICADO'] as const;
export const TURNOS = ['MANANA', 'TARDE', 'NOCHE', 'PARTIDO', 'ROTATIVO', 'OTRO'] as const;
export const MOTIVOS_REDUCCION = [
  'GUARDA_LEGAL',
  'LACTANCIA',
  'CUIDADO_FAMILIAR',
  'OTRO',
] as const;

const id = z.string().trim().min(1).max(40);
const fecha = z.string().refine(esFechaCivil, 'Introduce una fecha válida.');
const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((valor) => (valor === '' ? undefined : valor));
const fechaOpcional = opcional(10).refine(
  (valor) => valor === undefined || esFechaCivil(valor),
  'Introduce una fecha válida.',
);
const casilla = z
  // Acepta las dos formas que llegan: el valor crudo de una casilla HTML
  // («on» marcada, «» o ausente sin marcar) y el booleano que devuelve el
  // ayudante compartido `casilla(formData, campo)`. Aceptar sólo la primera
  // obligaba a cada acción a deshacer la conversión con `? 'on' : ''`, y la
  // que se olvidaba de hacerlo fallaba la validación en silencio.
  .union([z.literal('on'), z.literal(''), z.boolean()])
  .optional()
  .transform((valor) => valor === 'on' || valor === true);
const decimal = (minimo: number, maximo: number, mensaje: string) =>
  z
    .union([z.string(), z.number()])
    .transform((valor) =>
      typeof valor === 'number'
        ? valor
        : Number(valor.trim().replace(/\./gu, '').replace(',', '.')),
    )
    .refine((valor) => Number.isFinite(valor) && valor >= minimo && valor <= maximo, mensaje);
const decimalOpcional = (minimo: number, maximo: number) =>
  z
    .union([z.string(), z.number(), z.undefined()])
    .transform((valor) => {
      if (valor === undefined || valor === '') return undefined;
      return typeof valor === 'number'
        ? valor
        : Number(valor.trim().replace(/\./gu, '').replace(',', '.'));
    })
    .refine(
      (valor) =>
        valor === undefined || (Number.isFinite(valor) && valor >= minimo && valor <= maximo),
      'Introduce un importe válido.',
    );

export const convenioSchema = z
  .object({
    nombre: z.string().trim().min(3, 'Identifica el convenio.').max(250),
    ambito: z.enum(AMBITOS_CONVENIO),
    sector: z.string().trim().min(2, 'Indica el sector.').max(120),
    provincia: opcional(80),
    codigoBoletin: opcional(100),
    fechaPublicacion: fechaOpcional,
    vigenciaDesde: fecha,
    vigenciaHasta: fechaOpcional,
    enUltraactividad: casilla,
    urlBoletin: z
      .union([z.url('La URL del boletín no es válida.'), z.literal('')])
      .optional()
      .transform((valor) => valor || undefined),
  })
  .refine((datos) => !datos.vigenciaHasta || datos.vigenciaHasta >= datos.vigenciaDesde, {
    path: ['vigenciaHasta'],
    message: 'La vigencia final no puede preceder al inicio.',
  });

export const categoriaProfesionalSchema = z.object({
  convenioId: id,
  grupo: z.string().trim().min(1).max(50),
  nivel: opcional(50),
  denominacion: z.string().trim().min(2, 'Indica la categoría.').max(150),
  grupoCotizacionSS: z.coerce.number().int().min(1).max(11),
});

export const tablaSalarialSchema = z.object({
  convenioId: id,
  categoriaId: id,
  ano: z.coerce.number().int().min(2000).max(2100),
  salarioBaseMensual: decimal(0, 1_000_000, 'Introduce un salario base válido.'),
  numeroPagas: z.coerce.number().int().min(1).max(24),
  jornadaAnualHoras: decimal(1, 4_000, 'Introduce una jornada anual válida.'),
  precioHoraExtra: decimalOpcional(0, 10_000),
  vigenciaDesde: fecha,
});

export const empleadoSchema = z
  .object({
    numeroEmpleado: z.string().trim().min(1, 'Indica el número de empleado.').max(40),
    nombre: z.string().trim().min(2).max(100),
    apellidos: z.string().trim().min(2).max(160),
    email: z
      .union([z.email('Correo no válido.'), z.literal('')])
      .optional()
      .transform((valor) => valor || undefined),
    telefono: opcional(40),
    puesto: opcional(120),
    estado: z.enum(ESTADOS_EMPLEADO),
    fechaAlta: fecha,
    fechaBaja: fechaOpcional,
    nif: opcional(20).transform((valor) => (valor ? normalizarNif(valor) : undefined)),
    numeroAfiliacionSS: opcional(24),
    codigoCuentaCotizacion: opcional(24),
    categoriaId: opcional(40),
    convenioId: opcional(40),
    codigoContratoSEPE: opcional(10),
    grupoCotizacion: z.coerce.number().int().min(1).max(11).optional(),
    jornadaPorcentaje: decimal(1, 100, 'La jornada debe estar entre 1% y 100%.'),
    horasSemanales: decimal(0.01, 80, 'Las horas deben estar entre 0,01 y 80.'),
    antiguedadReconocida: fecha,
    complementoAdPersonam: decimalOpcional(0, 1_000_000),
    esSubrogado: casilla,
    contratoOrigenSubrogacionId: opcional(40),
    tieneReduccionJornada: casilla,
    motivoReduccion: z.enum(MOTIVOS_REDUCCION).optional(),
    tieneDiscapacidadReconocida: casilla,
    esRepresentanteTrabajadores: casilla,
  })
  .superRefine((datos, contexto) => {
    if (datos.nif && !esNifONieValido(datos.nif)) {
      contexto.addIssue({
        code: 'custom',
        path: ['nif'],
        message: 'El NIF/NIE no supera su dígito de control.',
      });
    }
    if (datos.fechaBaja && datos.fechaBaja < datos.fechaAlta) {
      contexto.addIssue({
        code: 'custom',
        path: ['fechaBaja'],
        message: 'La baja no puede preceder al alta.',
      });
    }
    if (datos.categoriaId && !datos.convenioId) {
      contexto.addIssue({
        code: 'custom',
        path: ['convenioId'],
        message: 'La categoría necesita su convenio.',
      });
    }
    if (datos.tieneReduccionJornada && !datos.motivoReduccion) {
      contexto.addIssue({
        code: 'custom',
        path: ['motivoReduccion'],
        message: 'Indica el motivo protegido de la reducción.',
      });
    }
  });

export const adscripcionSchema = z
  .object({
    empleadoId: id,
    contratoId: id,
    categoriaId: id,
    centroTrabajo: z.string().trim().min(2).max(160),
    horasSemanales: decimal(0.01, 80, 'Las horas deben estar entre 0,01 y 80.'),
    porcentajeDedicacion: decimal(0.01, 150, 'La dedicación debe estar entre 0,01% y 150%.'),
    fechaAlta: fecha,
    fechaBaja: fechaOpcional,
    esPersonalClave: casilla,
    turno: z.enum(TURNOS),
  })
  .refine((datos) => !datos.fechaBaja || datos.fechaBaja >= datos.fechaAlta, {
    path: ['fechaBaja'],
    message: 'La baja no puede preceder al alta.',
  });

export const plantillaExigidaSchema = z.object({
  contratoId: id,
  categoriaId: id,
  centroTrabajo: z.string().trim().min(2).max(160),
  numeroPersonas: z.coerce.number().int().min(1).max(10_000),
  horasSemanales: decimal(0.01, 100_000, 'Introduce las horas exigidas.'),
  fuente: z.enum(FUENTES_PLANTILLA),
  clausula: z.string().trim().min(10, 'Cita literalmente la cláusula del pliego.').max(4_000),
  esVinculante: casilla,
  penalidadDescripcion: opcional(1_000),
});

export const tipoCertificacionSchema = z.object({
  codigo: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((valor) => valor.toUpperCase().replace(/[^A-Z0-9]+/gu, '_')),
  nombre: z.string().trim().min(2).max(150),
  periodoRenovacionMeses: z.coerce.number().int().min(1).max(240).optional(),
  diasAviso: z.coerce.number().int().min(0).max(730).default(90),
  esObligatoria: casilla,
});

export const certificacionEmpleadoSchema = z
  .object({
    empleadoId: id,
    tipoId: id,
    referencia: opcional(120),
    emitidaPor: opcional(160),
    fechaEmision: fechaOpcional,
    fechaCaducidad: fechaOpcional,
    documentoId: opcional(40),
  })
  .refine(
    (datos) =>
      !datos.fechaEmision ||
      !datos.fechaCaducidad ||
      datos.fechaCaducidad >= datos.fechaEmision,
    { path: ['fechaCaducidad'], message: 'La caducidad no puede preceder a la emisión.' },
  );

export type EmpleadoInput = z.infer<typeof empleadoSchema>;
export type ConvenioInput = z.infer<typeof convenioSchema>;
