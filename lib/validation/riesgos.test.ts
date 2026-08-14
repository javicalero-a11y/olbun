import { describe, expect, it } from 'vitest';

import {
  accionCorrectoraSchema,
  actualizarIncidenciaSchema,
  bandasRiesgoSchema,
  categoriaRiesgoCrearSchema,
  revisionRiesgoSchema,
} from './riesgos';

describe('validación de revisiones de riesgo', () => {
  const base = {
    riesgoId: 'riesgo-prueba',
    resultado: 'SIN_CAMBIOS',
    comentarios: 'Se revisan controles, evidencias y exposición vigente.',
    proximaRevision: '2026-09-14',
  } as const;

  it('acepta una revisión sin cambio con nueva fecha', () => {
    expect(revisionRiesgoSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza un residual incompleto', () => {
    const resultado = revisionRiesgoSchema.safeParse({
      ...base,
      resultado: 'REVALORADO',
      probabilidadResidual: '3',
    });

    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.flatten().fieldErrors.probabilidadResidual).toContain(
        'Valora juntos probabilidad e impacto residual.',
      );
    }
  });

  it('permite cerrar sin programar otra revisión', () => {
    expect(
      revisionRiesgoSchema.safeParse({
        ...base,
        resultado: 'CERRADO',
        proximaRevision: '',
      }).success,
    ).toBe(true);
  });
});

describe('validación de configuración de riesgos', () => {
  const matriz = {
    bajoNombre: 'Bajo',
    bajoColor: '#64748b',
    bajoHasta: '4',
    medioNombre: 'Medio',
    medioColor: '#d97706',
    medioHasta: '9',
    altoNombre: 'Alto',
    altoColor: '#dc2626',
    altoHasta: '15',
    muyAltoNombre: 'Muy alto',
    muyAltoColor: '#991b1b',
  };

  it('normaliza una clave de negocio sin perder el nombre visible', () => {
    const resultado = categoriaRiesgoCrearSchema.parse({
      clave: 'Suministro crítico',
      nombre: 'Suministro crítico',
      color: '#2563eb',
    });
    expect(resultado.clave).toBe('SUMINISTRO_CRITICO');
    expect(resultado.nombre).toBe('Suministro crítico');
  });

  it('acepta cuatro tramos consecutivos y rechaza fronteras cruzadas', () => {
    expect(bandasRiesgoSchema.safeParse(matriz).success).toBe(true);
    expect(bandasRiesgoSchema.safeParse({ ...matriz, medioHasta: '3' }).success).toBe(false);
  });
});

describe('validación de acciones e incidencias', () => {
  it('exige exactamente un origen para cada acción', () => {
    const comunes = {
      titulo: 'Revisar el parte diario',
      descripcion: 'Añadir la doble firma antes de cerrar cada turno.',
      prioridad: 'ALTA',
    } as const;

    expect(accionCorrectoraSchema.safeParse(comunes).success).toBe(false);
    expect(
      accionCorrectoraSchema.safeParse({
        ...comunes,
        riesgoId: 'riesgo-prueba',
        incidenciaId: 'incidencia-prueba',
      }).success,
    ).toBe(false);
    expect(
      accionCorrectoraSchema.safeParse({ ...comunes, riesgoId: 'riesgo-prueba' }).success,
    ).toBe(true);
  });

  it('normaliza las casillas ausentes como falsas', () => {
    const resultado = actualizarIncidenciaSchema.parse({
      incidenciaId: 'incidencia-prueba',
      estado: 'EN_INVESTIGACION',
    });

    expect(resultado.comunicadaAlOrgano).toBe(false);
    expect(resultado.notificadaAAutoridad).toBe(false);
  });
});
