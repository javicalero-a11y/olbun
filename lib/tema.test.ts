import { describe, expect, it } from 'vitest';

import { claseDe, esTema, leerTema, TEMA_POR_DEFECTO } from './tema';

describe('leerTema', () => {
  it('sin cookie, el tema es el oscuro', () => {
    expect(leerTema(undefined)).toBe('oscuro');
    expect(TEMA_POR_DEFECTO).toBe('oscuro');
  });

  it('respeta la elección guardada', () => {
    expect(leerTema('claro')).toBe('claro');
    expect(leerTema('oscuro')).toBe('oscuro');
  });

  it('una cookie manipulada no cambia nada: vuelve al oscuro', () => {
    expect(leerTema('<script>')).toBe('oscuro');
    expect(leerTema('')).toBe('oscuro');
  });
});

describe('esTema', () => {
  it('sólo acepta los dos valores conocidos', () => {
    expect(esTema('claro')).toBe(true);
    expect(esTema('oscuro')).toBe(true);
    expect(esTema('dark')).toBe(false);
    expect(esTema(undefined)).toBe(false);
  });
});

describe('claseDe', () => {
  it('el oscuro pone la clase que usa la variante dark: de Tailwind', () => {
    expect(claseDe('oscuro')).toBe('dark');
  });

  it('el claro no pone ninguna', () => {
    expect(claseDe('claro')).toBe('');
  });
});
