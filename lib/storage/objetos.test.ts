import { describe, expect, it } from 'vitest';

import { claveDe, guardarObjeto, huellaDeContenido, leerObjeto } from './objetos';

/**
 * Runs against the MinIO in docker-compose. Not a unit test: it is here to
 * prove the round trip and the integrity check behave against a real S3
 * implementation rather than a mock that agrees with us.
 */
describe('almacenamiento de objetos', () => {
  const org = 'org-de-prueba';

  it('guarda y devuelve los mismos bytes', async () => {
    const contenido = Buffer.from(`pliego de prescripciones ${String(Date.now())}`);
    const guardado = await guardarObjeto(org, contenido, {
      nombre: 'pliego.txt',
      mimeType: 'text/plain',
    });

    expect(guardado.sha256).toBe(huellaDeContenido(contenido));
    expect(guardado.clave).toBe(claveDe(org, guardado.sha256));

    const leido = await leerObjeto(guardado.clave, guardado.sha256);
    expect(leido.equals(contenido)).toBe(true);
  });

  it('el mismo fichero dos veces es un solo objeto', async () => {
    const contenido = Buffer.from('acta de inicio, siempre la misma');
    const primero = await guardarObjeto(org, contenido, {
      nombre: 'acta.txt',
      mimeType: 'text/plain',
    });
    const segundo = await guardarObjeto(org, contenido, {
      nombre: 'acta-copia.txt',
      mimeType: 'text/plain',
    });

    expect(segundo.clave).toBe(primero.clave);
    expect(segundo.yaExistia).toBe(true);
  });

  it('se niega a entregar un fichero cuya huella no cuadra', async () => {
    const guardado = await guardarObjeto(org, Buffer.from('resolución'), {
      nombre: 'r.txt',
      mimeType: 'text/plain',
    });

    await expect(leerObjeto(guardado.clave, 'a'.repeat(64))).rejects.toThrow(/no coincide/);
  });
});
