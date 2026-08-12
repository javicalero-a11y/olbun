import { describe, expect, it } from 'vitest';

import { nombreProvisional } from './adaptador';

describe('nombreProvisional', () => {
  it('usa la parte local de la dirección', () => {
    expect(nombreProvisional('javier@guadaira.example')).toBe('javier');
  });

  it('convierte los separadores en espacios', () => {
    expect(nombreProvisional('marta.iglesias@ejemplo.es')).toBe('marta iglesias');
    expect(nombreProvisional('ana_ruiz@ejemplo.es')).toBe('ana ruiz');
    expect(nombreProvisional('luis-gomez@ejemplo.es')).toBe('luis gomez');
  });

  it('no inventa mayúsculas ni reordena: es un marcador, no un nombre', () => {
    // Equivocarse con el nombre de alguien es peor que enseñarle algo que
    // se ve provisional y que puede corregir.
    expect(nombreProvisional('gomez.perez.de.la.fuente@ejemplo.es')).toBe(
      'gomez perez de la fuente',
    );
  });

  it('no devuelve una cadena vacía cuando la parte local no aporta nada', () => {
    expect(nombreProvisional('___@ejemplo.es')).toBe('___@ejemplo.es');
  });

  it('aguanta una dirección sin arroba', () => {
    expect(nombreProvisional('sinarroba')).toBe('sinarroba');
  });
});
