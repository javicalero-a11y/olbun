import { describe, expect, it } from 'vitest';

import { historicoDentroDelLimite, validarGarantiasBuzon } from './conexion';

describe('garantías para conectar buzones', () => {
  it('permite un buzón funcional sin documentación laboral', () => {
    expect(validarGarantiasBuzon({ esPersonal: false })).toEqual({
      permitida: true,
      faltan: [],
    });
  });

  it('bloquea un buzón personal si faltan ambas garantías', () => {
    expect(validarGarantiasBuzon({ esPersonal: true })).toEqual({
      permitida: false,
      faltan: ['POLITICA_INTERNA', 'CONSULTA_REPRESENTACION'],
    });
  });

  it('no confunde tener sólo la política con completar la puerta', () => {
    expect(
      validarGarantiasBuzon({ esPersonal: true, politicaInternaDocumentoId: 'doc-1' }),
    ).toEqual({ permitida: false, faltan: ['CONSULTA_REPRESENTACION'] });
  });

  it('permite el buzón personal con documento y fecha', () => {
    expect(
      validarGarantiasBuzon({
        esPersonal: true,
        politicaInternaDocumentoId: 'doc-1',
        consultaRepresentacionFecha: '2026-02-10',
      }),
    ).toEqual({ permitida: true, faltan: [] });
  });
});

describe('ventana de importación histórica', () => {
  it('admite exactamente un año', () => {
    expect(historicoDentroDelLimite('2025-08-14', '2026-08-14')).toBe(true);
  });

  it('rechaza más de un año, el futuro y fechas inválidas', () => {
    expect(historicoDentroDelLimite('2025-08-13', '2026-08-14')).toBe(false);
    expect(historicoDentroDelLimite('2026-08-15', '2026-08-14')).toBe(false);
    expect(historicoDentroDelLimite('no-es-fecha', '2026-08-14')).toBe(false);
  });
});
