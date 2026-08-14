export interface GarantiasConexionBuzon {
  esPersonal: boolean;
  politicaInternaDocumentoId?: string | null;
  consultaRepresentacionFecha?: string | null;
}

export interface ResultadoGarantiasBuzon {
  permitida: boolean;
  faltan: ('POLITICA_INTERNA' | 'CONSULTA_REPRESENTACION')[];
}

/**
 * Functional mailboxes are the product default. Reading a named employee's
 * mailbox is a different processing operation and is blocked until both
 * Article 87 safeguards have been recorded.
 */
export function validarGarantiasBuzon(datos: GarantiasConexionBuzon): ResultadoGarantiasBuzon {
  if (!datos.esPersonal) return { permitida: true, faltan: [] };

  const faltan: ResultadoGarantiasBuzon['faltan'] = [];
  if (!datos.politicaInternaDocumentoId) faltan.push('POLITICA_INTERNA');
  if (!datos.consultaRepresentacionFecha) faltan.push('CONSULTA_REPRESENTACION');
  return { permitida: faltan.length === 0, faltan };
}

/** A bounded first import prevents an accidental multi-year mailbox scrape. */
export function historicoDentroDelLimite(
  desde: string,
  hoy: string,
  maximoDias = 365,
): boolean {
  const inicio = Date.parse(`${desde}T00:00:00Z`);
  const fin = Date.parse(`${hoy}T00:00:00Z`);
  if (!Number.isFinite(inicio) || !Number.isFinite(fin) || inicio > fin) return false;
  return (fin - inicio) / 86_400_000 <= maximoDias;
}
