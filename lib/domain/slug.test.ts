import { describe, expect, it } from 'vitest';

import { isReservedSlug, slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it('pasa a minúsculas y separa con guiones', () => {
    expect(slugify('Servicios Integrales')).toBe('servicios-integrales');
  });

  it('elimina acentos', () => {
    expect(slugify('Guadaíra Jardinería')).toBe('guadaira-jardineria');
    expect(slugify('Limpiezas Sánchez')).toBe('limpiezas-sanchez');
  });

  it('convierte la ñ en n', () => {
    expect(slugify('Peñarroya Servicios')).toBe('penarroya-servicios');
    expect(slugify('Logroño')).toBe('logrono');
  });

  it('elimina la forma jurídica del final', () => {
    expect(slugify('Servicios Integrales Guadaíra, S.L.')).toBe(
      'servicios-integrales-guadaira',
    );
    expect(slugify('EBONE Servicios S.A.')).toBe('ebone-servicios');
    expect(slugify('Jardines del Sur S.L.U.')).toBe('jardines-del-sur');
    expect(slugify('Cooperativa Andaluza S. Coop.')).toBe('cooperativa-andaluza');
  });

  it('no elimina la forma jurídica si es lo único que queda', () => {
    expect(slugify('S.L.')).toBe('sl');
  });

  it('elimina varias formas jurídicas encadenadas', () => {
    expect(slugify('Servicios Norte S.L. U.T.E.')).toBe('servicios-norte');
  });

  it('descarta signos de puntuación y símbolos', () => {
    expect(slugify('Limpiezas & Mantenimiento ¡Ya!')).toBe('limpiezas-mantenimiento-ya');
    expect(slugify('Grupo (Sur) 2026')).toBe('grupo-sur-2026');
  });

  it('colapsa espacios y guiones repetidos', () => {
    expect(slugify('Grupo   ---   Sur')).toBe('grupo-sur');
  });

  it('no deja guiones al principio ni al final', () => {
    const slug = slugify('  -- Servicios --  ');
    expect(slug.startsWith('-')).toBe(false);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('recorta a una longitud razonable sin dejar guion final', () => {
    const slug = slugify('Empresa Municipal de Servicios Urbanos y Medioambientales del Área');
    expect(slug.length).toBeLessThanOrEqual(48);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('devuelve cadena vacía cuando no queda nada utilizable', () => {
    expect(slugify('¿¡...!?')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});

describe('isReservedSlug', () => {
  it('reconoce las rutas reservadas de la aplicación', () => {
    for (const reserved of ['api', 'acceso', 'registro', 'ajustes', 'health']) {
      expect(isReservedSlug(reserved), reserved).toBe(true);
    }
  });

  it('no marca un nombre de empresa normal', () => {
    expect(isReservedSlug('servicios-guadaira')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  it('devuelve el slug base si está libre', () => {
    expect(uniqueSlug('Servicios Guadaíra S.L.', new Set())).toBe('servicios-guadaira');
  });

  it('añade sufijo numérico ante colisión', () => {
    const taken = new Set(['servicios-guadaira']);
    expect(uniqueSlug('Servicios Guadaíra S.L.', taken)).toBe('servicios-guadaira-2');
  });

  it('sigue incrementando mientras haya colisiones', () => {
    const taken = new Set(['grupo-sur', 'grupo-sur-2', 'grupo-sur-3']);
    expect(uniqueSlug('Grupo Sur', taken)).toBe('grupo-sur-4');
  });

  it('evita colisionar con una ruta reservada', () => {
    expect(uniqueSlug('API', new Set())).toBe('api-2');
  });

  it('usa un nombre por defecto cuando el nombre no produce slug', () => {
    expect(uniqueSlug('¿¡!?', new Set())).toBe('organizacion');
  });

  it('el resultado con sufijo respeta la longitud máxima', () => {
    const largo =
      'Empresa Municipal de Servicios Urbanos y Medioambientales del Área Metropolitana';
    const base = uniqueSlug(largo, new Set());
    const conflicto = uniqueSlug(largo, new Set([base]));

    expect(conflicto.length).toBeLessThanOrEqual(48);
    expect(conflicto).not.toBe(base);
  });
});
