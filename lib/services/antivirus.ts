import 'server-only';

import { createConnection } from 'node:net';

import { serverEnv } from '@/lib/env';

const TAMANO_BLOQUE = 64 * 1024;

export type ResultadoAntivirus =
  | { estado: 'LIMPIO'; respuesta: string }
  | { estado: 'INFECTADO'; firma: string; respuesta: string }
  | { estado: 'NO_ANALIZADO'; motivo: string };

export interface ConfiguracionClamAV {
  host: string;
  port: number;
  timeoutMs: number;
}

function interpretarRespuesta(respuestaCruda: string): ResultadoAntivirus {
  const respuesta = respuestaCruda.replaceAll('\0', '').trim();

  if (/:\s+OK$/u.test(respuesta)) return { estado: 'LIMPIO', respuesta };

  const encontrada = respuesta.match(/:\s+(.+?)\s+FOUND$/u);
  if (encontrada?.[1]) {
    return { estado: 'INFECTADO', firma: encontrada[1], respuesta };
  }

  return {
    estado: 'NO_ANALIZADO',
    motivo: respuesta === '' ? 'ClamAV cerró la conexión sin responder.' : respuesta,
  };
}

/**
 * Streams a buffer to clamd using its length-prefixed INSTREAM protocol.
 *
 * No temporary file is created and the scanner never receives an S3 key. If
 * the daemon is unavailable the result is explicitly NO_ANALIZADO: an outage
 * must never turn into a green badge.
 */
export async function analizarConClamAV(
  contenido: Buffer,
  configuracion?: ConfiguracionClamAV,
): Promise<ResultadoAntivirus> {
  const env = serverEnv();
  const config = configuracion ?? {
    host: env.CLAMAV_HOST,
    port: env.CLAMAV_PORT,
    timeoutMs: env.CLAMAV_TIMEOUT_MS,
  };

  return new Promise((resolve) => {
    const socket = createConnection({ host: config.host, port: config.port });
    const partes: Buffer[] = [];
    let terminado = false;

    const finalizar = (resultado: ResultadoAntivirus) => {
      if (terminado) return;
      terminado = true;
      socket.destroy();
      resolve(resultado);
    };

    socket.setTimeout(config.timeoutMs);
    socket.on('timeout', () => {
      finalizar({ estado: 'NO_ANALIZADO', motivo: 'ClamAV no respondió dentro del plazo.' });
    });
    socket.on('error', (error) => {
      finalizar({
        estado: 'NO_ANALIZADO',
        motivo: `ClamAV no está disponible: ${error.message}`,
      });
    });
    socket.on('data', (parte: Buffer) => {
      partes.push(parte);
      if (parte.includes(0)) finalizar(interpretarRespuesta(Buffer.concat(partes).toString()));
    });
    socket.on('end', () => {
      finalizar(interpretarRespuesta(Buffer.concat(partes).toString()));
    });
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');

      for (let offset = 0; offset < contenido.length; offset += TAMANO_BLOQUE) {
        const bloque = contenido.subarray(offset, offset + TAMANO_BLOQUE);
        const longitud = Buffer.allocUnsafe(4);
        longitud.writeUInt32BE(bloque.length);
        socket.write(longitud);
        socket.write(bloque);
      }

      socket.end(Buffer.alloc(4));
    });
  });
}

export const _pruebasAntivirus = { interpretarRespuesta };
