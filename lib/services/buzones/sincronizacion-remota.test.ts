import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cifrar } from '@/lib/crypto/cifrado';
import { resetServerEnvCache } from '@/lib/env';
import { obtenerLoteRemoto, type BuzonParaSincronizar } from './sincronizacion-remota';

const EML = Buffer.from(
  'Message-ID: <oauth-1@example.com>\r\nFrom: autoridad@example.com\r\nTo: contratos@example.com\r\nSubject: Requerimiento\r\nDate: Fri, 14 Aug 2026 08:00:00 +0200\r\n\r\nConteste en diez dias.',
);

function buzon(tipo: BuzonParaSincronizar['tipo']): BuzonParaSincronizar {
  return {
    tipo,
    direccion: 'contratos@example.com',
    tokenAccesoCifrado: cifrar('access-vigente'),
    tokenRefrescoCifrado: cifrar('refresh-vigente'),
    tokenExpiraEn: new Date(Date.now() + 3_600_000),
    scopesOAuth: ['Mail.Read'],
    cursorSincronizacion: null,
  };
}

function json(datos: unknown): Response {
  return new Response(JSON.stringify(datos), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function urlDe(entrada: string | URL | Request): URL {
  if (typeof entrada === 'string') return new URL(entrada);
  return new URL(entrada instanceof URL ? entrada.href : entrada.url);
}

describe('sincronización remota', () => {
  beforeEach(() => {
    vi.stubEnv('ENCRYPTION_KEY', Buffer.alloc(32, 9).toString('base64'));
    resetServerEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it('Gmail trae el MIME original y conserva el historyId como cursor', async () => {
    const fetchMock = vi.fn((entrada: string | URL | Request) => {
      const url = urlDe(entrada);
      if (url.pathname.endsWith('/messages')) {
        return Promise.resolve(json({ messages: [{ id: 'g-1' }] }));
      }
      if (url.pathname.endsWith('/messages/g-1')) {
        return Promise.resolve(
          json({ id: 'g-1', raw: EML.toString('base64url'), labelIds: ['INBOX'] }),
        );
      }
      if (url.pathname.endsWith('/profile')) {
        return Promise.resolve(json({ historyId: 'hist-22' }));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const lote = await obtenerLoteRemoto(buzon('GOOGLE_FUNCIONAL'), new Date('2026-08-01'));
    expect(lote.cursor).toBe('hist-22');
    expect(lote.historicoCompleto).toBe(true);
    expect(lote.mensajes).toEqual([{ remotoId: 'g-1', direccion: 'ENTRANTE', raw: EML }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('Gmail incremental sólo descarga las altas posteriores al cursor', async () => {
    const conectado = { ...buzon('GOOGLE_FUNCIONAL'), cursorSincronizacion: 'hist-20' };
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string | URL | Request) => {
        const url = urlDe(entrada);
        if (url.pathname.endsWith('/history')) {
          expect(url.searchParams.get('startHistoryId')).toBe('hist-20');
          return Promise.resolve(
            json({
              historyId: 'hist-21',
              history: [{ messagesAdded: [{ message: { id: 'g-2' } }] }],
            }),
          );
        }
        if (url.pathname.endsWith('/messages/g-2')) {
          return Promise.resolve(
            json({ id: 'g-2', raw: EML.toString('base64url'), labelIds: ['SENT'] }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    const lote = await obtenerLoteRemoto(conectado, null);
    expect(lote.cursor).toBe('hist-21');
    expect(lote.mensajes[0]?.direccion).toBe('SALIENTE');
  });

  it('Gmail conserva la página pendiente al alcanzar el límite de 500 mensajes', async () => {
    let pagina = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string | URL | Request) => {
        const url = urlDe(entrada);
        if (url.pathname.endsWith('/messages')) {
          pagina += 1;
          return Promise.resolve(
            json({
              messages: Array.from({ length: 100 }, (_, indice) => ({
                id: `g-${String(pagina)}-${String(indice)}`,
              })),
              nextPageToken: `pagina-${String(pagina + 1)}`,
            }),
          );
        }
        if (url.pathname.includes('/messages/g-')) {
          const id = url.pathname.split('/').at(-1) ?? 'g-desconocido';
          return Promise.resolve(
            json({ id, raw: EML.toString('base64url'), labelIds: ['INBOX'] }),
          );
        }
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    const lote = await obtenerLoteRemoto(buzon('GOOGLE_FUNCIONAL'), new Date('2026-08-01'));
    expect(lote.mensajes).toHaveLength(500);
    expect(lote.historicoCompleto).toBe(false);
    expect(JSON.parse(lote.cursor)).toEqual({
      tipo: 'INICIAL',
      pagina: 'pagina-6',
      desde: '2026-08-01T00:00:00.000Z',
    });
  });

  it('Graph mantiene un delta independiente para entrada y enviados', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((entrada: string | URL | Request) => {
        const url = urlDe(entrada);
        if (url.pathname.includes('/inbox/messages/delta')) {
          return Promise.resolve(
            json({
              value: [{ id: 'm-in' }],
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/inbox-delta-final',
            }),
          );
        }
        if (url.pathname.includes('/sentitems/messages/delta')) {
          return Promise.resolve(
            json({
              value: [{ id: 'm-out' }],
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/sent-delta-final',
            }),
          );
        }
        if (url.pathname.includes('/messages/m-in/')) return Promise.resolve(new Response(EML));
        if (url.pathname.includes('/messages/m-out/'))
          return Promise.resolve(new Response(EML));
        return Promise.resolve(new Response(null, { status: 404 }));
      }),
    );

    const lote = await obtenerLoteRemoto(buzon('MS365_FUNCIONAL'), null);
    expect(lote.mensajes.map((mensaje) => mensaje.direccion)).toEqual(['ENTRANTE', 'SALIENTE']);
    expect(JSON.parse(lote.cursor)).toEqual({
      inbox: 'https://graph.microsoft.com/v1.0/inbox-delta-final',
      sentitems: 'https://graph.microsoft.com/v1.0/sent-delta-final',
    });
    expect(lote.historicoCompleto).toBe(true);
  });
});
