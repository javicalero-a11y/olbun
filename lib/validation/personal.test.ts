import { describe, expect, it } from 'vitest';

import { adscripcionSchema, empleadoSchema, tablaSalarialSchema } from './personal';

const empleadoValido = {
  numeroEmpleado: 'EMP-001',
  nombre: 'Ana',
  apellidos: 'Ruiz',
  email: '',
  telefono: '',
  puesto: 'Encargada',
  estado: 'ACTIVO',
  fechaAlta: '2024-01-01',
  fechaBaja: '',
  nif: '12345678Z',
  numeroAfiliacionSS: '',
  codigoCuentaCotizacion: '',
  categoriaId: '',
  convenioId: '',
  codigoContratoSEPE: '100',
  grupoCotizacion: '5',
  jornadaPorcentaje: '100',
  horasSemanales: '40',
  antiguedadReconocida: '2024-01-01',
  complementoAdPersonam: '',
  esSubrogado: '',
  contratoOrigenSubrogacionId: '',
  tieneReduccionJornada: '',
  tieneDiscapacidadReconocida: '',
  esRepresentanteTrabajadores: '',
};

describe('validación de personal', () => {
  it('acepta y normaliza un empleado válido', () => {
    const resultado = empleadoSchema.parse(empleadoValido);
    expect(resultado.nif).toBe('12345678Z');
    expect(resultado.horasSemanales).toBe(40);
  });

  it('rechaza NIF incorrecto y baja anterior', () => {
    const resultado = empleadoSchema.safeParse({
      ...empleadoValido,
      nif: '12345678A',
      fechaBaja: '2023-12-31',
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success)
      expect(resultado.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['nif', 'fechaBaja']),
      );
  });

  it('rechaza una adscripción invertida', () => {
    expect(
      adscripcionSchema.safeParse({
        empleadoId: 'e',
        contratoId: 'c',
        categoriaId: 'k',
        centroTrabajo: 'Centro',
        horasSemanales: '20',
        porcentajeDedicacion: '50',
        fechaAlta: '2026-02-01',
        fechaBaja: '2026-01-01',
        esPersonalClave: '',
        turno: 'MANANA',
      }).success,
    ).toBe(false);
  });

  it('interpreta importes españoles de tabla salarial', () => {
    const tabla = tablaSalarialSchema.parse({
      convenioId: 'c',
      categoriaId: 'k',
      ano: '2026',
      salarioBaseMensual: '1.325,50',
      numeroPagas: '14',
      jornadaAnualHoras: '1.792',
      precioHoraExtra: '14,25',
      vigenciaDesde: '2026-01-01',
    });
    expect(tabla.salarioBaseMensual).toBe(1325.5);
    expect(tabla.jornadaAnualHoras).toBe(1792);
  });

  it('acepta las casillas como booleano, que es lo que manda el formulario', () => {
    // `casilla(formData, campo)` del ayudante compartido devuelve un booleano,
    // no el «on» crudo del HTML. Cuando el esquema sólo admitía «on» el alta de
    // empleados fallaba entera y en silencio: cuatro casillas la tumbaban sin
    // que apareciera un solo mensaje en pantalla.
    const conBooleanos = empleadoSchema.safeParse({
      ...empleadoValido,
      esSubrogado: false,
      tieneReduccionJornada: false,
      tieneDiscapacidadReconocida: true,
      esRepresentanteTrabajadores: false,
    });

    expect(conBooleanos.success).toBe(true);
    if (conBooleanos.success) {
      expect(conBooleanos.data.tieneDiscapacidadReconocida).toBe(true);
      expect(conBooleanos.data.esSubrogado).toBe(false);
    }

    // Y sigue aceptando la forma cruda, que es la que llega de un envío sin JS.
    const conCadenas = empleadoSchema.safeParse({
      ...empleadoValido,
      esSubrogado: 'on',
      tieneReduccionJornada: '',
    });

    expect(conCadenas.success).toBe(true);
    if (conCadenas.success) expect(conCadenas.data.esSubrogado).toBe(true);
  });
});
