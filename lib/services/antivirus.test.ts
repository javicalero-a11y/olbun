import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';

import { _pruebasAntivirus, analizarConClamAV } from './antivirus';

const servidores: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servidores
      .splice(0)
      .map((servidor) => new Promise<void>((resolve) => servidor.close(() => resolve()))),
  );
});

async function servidorClam(respuesta: string): Promise<number> {
  const servidor = createServer((socket) => {
    const recibido: Buffer[] = [];
    socket.on('data', (parte) => recibido.push(parte));
    socket.on('end', () => {
      const todo = Buffer.concat(recibido);
      expect(todo.subarray(0, 10).toString()).toBe('zINSTREAM\0');
      socket.end(`${respuesta}\0`);
    });
  });
  servidores.push(servidor);
  await new Promise<void>((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const direccion = servidor.address();
  if (!direccion || typeof direccion === 'string')
    throw new Error('Puerto de prueba no creado.');
  return direccion.port;
}

describe('interpretarRespuesta', () => {
  it('distingue limpio, infectado y error del daemon', () => {
    expect(_pruebasAntivirus.interpretarRespuesta('stream: OK\0')).toMatchObject({
      estado: 'LIMPIO',
    });
    expect(
      _pruebasAntivirus.interpretarRespuesta('stream: Win.Test.EICAR_HDB-1 FOUND\0'),
    ).toMatchObject({ estado: 'INFECTADO', firma: 'Win.Test.EICAR_HDB-1' });
    expect(
      _pruebasAntivirus.interpretarRespuesta('INSTREAM size limit exceeded. ERROR'),
    ).toEqual({
      estado: 'NO_ANALIZADO',
      motivo: 'INSTREAM size limit exceeded. ERROR',
    });
  });
});

describe('analizarConClamAV', () => {
  it('envía INSTREAM y devuelve el veredicto limpio', async () => {
    const port = await servidorClam('stream: OK');
    await expect(
      analizarConClamAV(Buffer.from('acta'), { host: '127.0.0.1', port, timeoutMs: 1000 }),
    ).resolves.toMatchObject({ estado: 'LIMPIO' });
  });

  it('conserva la firma detectada', async () => {
    const port = await servidorClam('stream: Win.Test.EICAR_HDB-1 FOUND');
    await expect(
      analizarConClamAV(Buffer.from('eicar'), { host: '127.0.0.1', port, timeoutMs: 1000 }),
    ).resolves.toMatchObject({ estado: 'INFECTADO', firma: 'Win.Test.EICAR_HDB-1' });
  });

  it('nunca llama limpio a una caída del scanner', async () => {
    await expect(
      analizarConClamAV(Buffer.from('acta'), {
        host: '127.0.0.1',
        port: 1,
        timeoutMs: 1000,
      }),
    ).resolves.toMatchObject({ estado: 'NO_ANALIZADO' });
  });
});
