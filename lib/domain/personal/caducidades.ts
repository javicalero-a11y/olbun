import { diferenciaEnDias, type FechaCivil } from '@/lib/domain/fecha';

export type EstadoCaducidad = 'VALIDA' | 'PROXIMA_A_CADUCAR' | 'CADUCADA';

export function estadoDeCertificacion(
  fechaCaducidad: FechaCivil | undefined,
  hoy: FechaCivil,
  diasAviso = 90,
): EstadoCaducidad {
  if (!Number.isInteger(diasAviso) || diasAviso < 0 || diasAviso > 730) {
    throw new RangeError('diasAviso debe ser un entero entre 0 y 730.');
  }
  if (!fechaCaducidad) return 'VALIDA';

  const restantes = diferenciaEnDias(hoy, fechaCaducidad);
  if (restantes < 0) return 'CADUCADA';
  if (restantes <= diasAviso) return 'PROXIMA_A_CADUCAR';
  return 'VALIDA';
}
