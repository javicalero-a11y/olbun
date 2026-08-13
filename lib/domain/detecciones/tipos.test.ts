import { describe, expect, it } from 'vitest';

import {
  esBajaConfianza,
  prioridad,
  TIPOS_DETECCION,
  tiposPorGravedad,
  UMBRAL_CONFIANZA,
} from './tipos';
import type { TipoDeteccion } from '@prisma/client';

/**
 * The catalogue is what the prompt, the queue ordering and the confirmation
 * dialog all read from. An entry missing or malformed here does not fail
 * loudly — it produces a detection nobody can confirm.
 */

const TIPOS = Object.keys(TIPOS_DETECCION) as TipoDeteccion[];

describe('TIPOS_DETECCION', () => {
  it('cubre los catorce tipos del SPEC', () => {
    expect(TIPOS).toHaveLength(14);
  });

  it('cada tipo tiene etiqueta, descripción y señales para el prompt', () => {
    for (const tipo of TIPOS) {
      const definicion = TIPOS_DETECCION[tipo];
      expect(definicion.etiqueta.length, tipo).toBeGreaterThan(0);
      expect(definicion.descripcion.length, tipo).toBeGreaterThan(0);
      expect(definicion.senales.length, tipo).toBeGreaterThan(0);
    }
  });

  it('la gravedad está entre 0 y 1', () => {
    for (const tipo of TIPOS) {
      expect(TIPOS_DETECCION[tipo].gravedad, tipo).toBeGreaterThan(0);
      expect(TIPOS_DETECCION[tipo].gravedad, tipo).toBeLessThanOrEqual(1);
    }
  });

  it('todo tipo con destino EXPEDIENTE dice qué expediente abrir', () => {
    for (const tipo of TIPOS) {
      const definicion = TIPOS_DETECCION[tipo];
      if (definicion.destino === 'EXPEDIENTE') {
        expect(definicion.expediente, tipo).toBeDefined();
      } else {
        expect(definicion.expediente, tipo).toBeUndefined();
      }
    }
  });

  it('un plazo mencionado no crea nada por sí solo', () => {
    // SPEC §6.4: la fecha de un correo no es un Plazo hasta que alguien
    // comprueba en qué se funda.
    expect(TIPOS_DETECCION.PLAZO_MENCIONADO.destino).toBe('NINGUNO');
  });

  it('lo que amenaza al contrato pesa más que una queja', () => {
    expect(TIPOS_DETECCION.AMENAZA_RESOLUCION.gravedad).toBeGreaterThan(
      TIPOS_DETECCION.QUEJA_FORMAL.gravedad,
    );
    expect(TIPOS_DETECCION.INICIO_EXPEDIENTE_SANCIONADOR.gravedad).toBeGreaterThan(
      TIPOS_DETECCION.RECLAMACION_USUARIO.gravedad,
    );
  });
});

describe('prioridad', () => {
  it('una amenaza dudosa gana a una queja segura', () => {
    // El orden de la cola: la atención escasa va donde equivocarse cuesta más.
    expect(prioridad('AMENAZA_RESOLUCION', 0.6)).toBeGreaterThan(
      prioridad('RECLAMACION_USUARIO', 0.95),
    );
  });

  it('a igual tipo, manda la confianza', () => {
    expect(prioridad('PREAVISO_PENALIDAD', 0.9)).toBeGreaterThan(
      prioridad('PREAVISO_PENALIDAD', 0.5),
    );
  });
});

describe('esBajaConfianza', () => {
  it('separa por el umbral del SPEC', () => {
    expect(esBajaConfianza(UMBRAL_CONFIANZA - 0.01)).toBe(true);
    expect(esBajaConfianza(UMBRAL_CONFIANZA)).toBe(false);
  });

  it('el umbral por defecto es 0,6', () => {
    expect(UMBRAL_CONFIANZA).toBe(0.6);
  });
});

describe('tiposPorGravedad', () => {
  it('ordena de más grave a menos', () => {
    const gravedades = tiposPorGravedad().map((tipo) => TIPOS_DETECCION[tipo].gravedad);
    expect(gravedades).toEqual([...gravedades].sort((a, b) => b - a));
  });

  it('no se deja ninguno: es la lista que ve el modelo', () => {
    expect(tiposPorGravedad()).toHaveLength(TIPOS.length);
  });
});
