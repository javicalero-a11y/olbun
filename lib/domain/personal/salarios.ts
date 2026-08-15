export interface BaseTablaSalarial {
  salarioBaseMensual: number;
  numeroPagas: number;
  jornadaAnualHoras: number;
}

function exigirFinitoNoNegativo(valor: number, campo: string): void {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new RangeError(`${campo} debe ser un número finito no negativo.`);
  }
}

export function redondearImporte(valor: number, decimales = 2): number {
  if (!Number.isInteger(decimales) || decimales < 0 || decimales > 6) {
    throw new RangeError('Los decimales deben estar entre 0 y 6.');
  }
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

export function salarioBaseAnual(tabla: BaseTablaSalarial): number {
  exigirFinitoNoNegativo(tabla.salarioBaseMensual, 'salarioBaseMensual');
  if (!Number.isInteger(tabla.numeroPagas) || tabla.numeroPagas < 1 || tabla.numeroPagas > 24) {
    throw new RangeError('numeroPagas debe ser un entero entre 1 y 24.');
  }
  return redondearImporte(tabla.salarioBaseMensual * tabla.numeroPagas);
}

/** Published base price only; company contributions arrive in M14. */
export function precioHoraOrdinaria(tabla: BaseTablaSalarial): number {
  exigirFinitoNoNegativo(tabla.jornadaAnualHoras, 'jornadaAnualHoras');
  if (tabla.jornadaAnualHoras === 0) {
    throw new RangeError('jornadaAnualHoras debe ser mayor que cero.');
  }
  return redondearImporte(salarioBaseAnual(tabla) / tabla.jornadaAnualHoras, 4);
}
