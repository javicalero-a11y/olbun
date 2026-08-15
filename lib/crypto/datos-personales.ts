import 'server-only';

import { cifrar, descifrar } from '@/lib/crypto/cifrado';
import { indiceCiegoNif, indicesCiegosNif } from '@/lib/crypto/cifrado-nucleo';

export interface IdentificacionProtegida {
  nif?: string | undefined;
  numeroAfiliacionSS?: string | undefined;
  codigoCuentaCotizacion?: string | undefined;
}

export interface DatosLaboralesProtegidos {
  complementoAdPersonam?: number | undefined;
  motivoReduccion?: 'GUARDA_LEGAL' | 'LACTANCIA' | 'CUIDADO_FAMILIAR' | 'OTRO' | undefined;
  tieneDiscapacidadReconocida?: boolean | undefined;
}

export function cifrarObjeto(valor: object): string {
  return cifrar(JSON.stringify(valor));
}

export function descifrarObjeto<T>(valor: string): T {
  return JSON.parse(descifrar(valor)) as T;
}

/**
 * Blind index for duplicate detection. HMAC prevents a leaked database from
 * turning the tiny NIF search space into a useful rainbow table.
 */
export function indiceNif(nif: string): string {
  return indiceCiegoNif(nif);
}

export function indicesNifLegibles(nif: string): string[] {
  return indicesCiegosNif(nif);
}
