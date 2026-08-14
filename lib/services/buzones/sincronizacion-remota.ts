import 'server-only';

import { z } from 'zod';

import { descifrar } from '@/lib/crypto/cifrado';
import {
  ErrorProveedorCorreo,
  refrescarToken,
  type CredencialOAuth,
  type ProveedorCorreo,
} from './oauth';

export interface BuzonParaSincronizar {
  tipo: 'GOOGLE_FUNCIONAL' | 'MS365_FUNCIONAL';
  direccion: string;
  tokenAccesoCifrado: string;
  tokenRefrescoCifrado: string;
  tokenExpiraEn: Date;
  scopesOAuth: string[];
  cursorSincronizacion: string | null;
}

export interface MensajeRemoto {
  remotoId: string;
  direccion: 'ENTRANTE' | 'SALIENTE';
  raw: Buffer;
}

export interface LoteSincronizacion {
  mensajes: MensajeRemoto[];
  cursor: string;
  credencial: CredencialOAuth;
  /** False while an initial provider page is still pending. */
  historicoCompleto: boolean;
}

const listaGmailSchema = z.object({
  messages: z.array(z.object({ id: z.string() })).optional(),
  nextPageToken: z.string().optional(),
});
const historiaGmailSchema = z.object({
  history: z
    .array(
      z.object({
        messagesAdded: z.array(z.object({ message: z.object({ id: z.string() }) })).optional(),
      }),
    )
    .optional(),
  historyId: z.string(),
  nextPageToken: z.string().optional(),
});
const rawGmailSchema = z.object({
  id: z.string(),
  raw: z.string(),
  labelIds: z.array(z.string()).optional(),
});
const perfilGmailSchema = z.object({ historyId: z.string() });

const deltaGraphSchema = z.object({
  value: z.array(z.object({ id: z.string(), '@removed': z.unknown().optional() })),
  '@odata.nextLink': z.string().url().optional(),
  '@odata.deltaLink': z.string().url().optional(),
});

class RespuestaProveedor extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function peticion(url: string, accessToken: string): Promise<Response> {
  const parsed = new URL(url);
  const permitido =
    parsed.protocol === 'https:' &&
    (parsed.hostname === 'gmail.googleapis.com' || parsed.hostname === 'graph.microsoft.com');
  if (!permitido) throw new Error('El cursor del proveedor apunta a un destino no permitido.');

  const respuesta = await fetch(parsed, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new ErrorProveedorCorreo('La autorización del buzón ya no es válida.', true);
  }
  if (!respuesta.ok)
    throw new RespuestaProveedor(respuesta.status, 'El proveedor no respondió.');
  return respuesta;
}

async function json(url: string, accessToken: string): Promise<unknown> {
  return (await peticion(url, accessToken)).json();
}

async function credencialVigente(buzon: BuzonParaSincronizar): Promise<CredencialOAuth> {
  const accessToken = descifrar(buzon.tokenAccesoCifrado);
  const refreshToken = descifrar(buzon.tokenRefrescoCifrado);
  if (buzon.tokenExpiraEn.getTime() > Date.now() + 120_000) {
    return {
      accessToken,
      refreshToken,
      expiraEn: buzon.tokenExpiraEn,
      scopes: buzon.scopesOAuth,
    };
  }
  const proveedor: ProveedorCorreo = buzon.tipo === 'GOOGLE_FUNCIONAL' ? 'GOOGLE' : 'MICROSOFT';
  const renovada = await refrescarToken(proveedor, refreshToken);
  return { ...renovada, refreshToken: renovada.refreshToken ?? refreshToken };
}

function gmailQuery(desde: Date | null): string {
  const fecha = desde ?? new Date(Date.now() - 30 * 86_400_000);
  return `after:${fecha.toISOString().slice(0, 10).replaceAll('-', '/')}`;
}

interface PaginaGmail {
  ids: string[];
  siguiente?: string | undefined;
}

async function idsInicialesGmail(
  accessToken: string,
  desde: Date | null,
  paginaInicial?: string,
): Promise<PaginaGmail> {
  const ids: string[] = [];
  let pagina: string | undefined = paginaInicial;
  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
    url.searchParams.set('maxResults', '100');
    url.searchParams.set('q', gmailQuery(desde));
    if (pagina) url.searchParams.set('pageToken', pagina);
    const lote = listaGmailSchema.parse(await json(url.toString(), accessToken));
    ids.push(...(lote.messages ?? []).map((mensaje) => mensaje.id));
    pagina = lote.nextPageToken;
  } while (pagina && ids.length < 500);
  return { ids: ids.slice(0, 500), siguiente: pagina };
}

async function idsIncrementalesGmail(
  accessToken: string,
  cursor: string,
  paginaInicial?: string,
): Promise<{ ids: string[]; cursor: string; siguiente?: string | undefined }> {
  const ids = new Set<string>();
  let pagina: string | undefined = paginaInicial;
  let ultimo = cursor;
  do {
    const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history');
    url.searchParams.set('startHistoryId', cursor);
    url.searchParams.set('historyTypes', 'messageAdded');
    url.searchParams.set('maxResults', '100');
    if (pagina) url.searchParams.set('pageToken', pagina);
    const lote = historiaGmailSchema.parse(await json(url.toString(), accessToken));
    for (const historia of lote.history ?? []) {
      for (const alta of historia.messagesAdded ?? []) ids.add(alta.message.id);
    }
    ultimo = lote.historyId;
    pagina = lote.nextPageToken;
  } while (pagina && ids.size < 500);
  return { ids: [...ids].slice(0, 500), cursor: ultimo, siguiente: pagina };
}

const cursorGmailSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('INICIAL'), pagina: z.string(), desde: z.string().datetime() }),
  z.object({ tipo: z.literal('HISTORIA'), pagina: z.string(), historyId: z.string() }),
]);

type CursorGmailPendiente = z.infer<typeof cursorGmailSchema>;

function leerCursorGmail(cursor: string | null): CursorGmailPendiente | string | null {
  if (!cursor) return null;
  try {
    return cursorGmailSchema.parse(JSON.parse(cursor));
  } catch {
    // A plain provider historyId is the steady-state cursor and all cursors
    // written before paginated imports were introduced have this shape.
    return cursor;
  }
}

async function mensajeGmail(id: string, accessToken: string): Promise<MensajeRemoto> {
  const url = new URL(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}`,
  );
  url.searchParams.set('format', 'raw');
  const mensaje = rawGmailSchema.parse(await json(url.toString(), accessToken));
  return {
    remotoId: mensaje.id,
    direccion: mensaje.labelIds?.includes('SENT') ? 'SALIENTE' : 'ENTRANTE',
    raw: Buffer.from(mensaje.raw, 'base64url'),
  };
}

async function sincronizarGmail(
  buzon: BuzonParaSincronizar,
  credencial: CredencialOAuth,
  desde: Date | null,
): Promise<{ mensajes: MensajeRemoto[]; cursor: string; historicoCompleto: boolean }> {
  let ids: string[];
  let cursor: string | undefined;
  let historicoCompleto = true;
  const estadoCursor = leerCursorGmail(buzon.cursorSincronizacion);
  if (estadoCursor && typeof estadoCursor !== 'string' && estadoCursor.tipo === 'INICIAL') {
    const pagina = await idsInicialesGmail(
      credencial.accessToken,
      new Date(estadoCursor.desde),
      estadoCursor.pagina,
    );
    ids = pagina.ids;
    if (pagina.siguiente) {
      cursor = JSON.stringify({ ...estadoCursor, pagina: pagina.siguiente });
      historicoCompleto = false;
    }
  } else if (
    estadoCursor &&
    typeof estadoCursor !== 'string' &&
    estadoCursor.tipo === 'HISTORIA'
  ) {
    const incremental = await idsIncrementalesGmail(
      credencial.accessToken,
      estadoCursor.historyId,
      estadoCursor.pagina,
    );
    ids = incremental.ids;
    cursor = incremental.siguiente
      ? JSON.stringify({
          tipo: 'HISTORIA',
          pagina: incremental.siguiente,
          historyId: estadoCursor.historyId,
        })
      : incremental.cursor;
  } else if (typeof estadoCursor === 'string') {
    try {
      const incremental = await idsIncrementalesGmail(credencial.accessToken, estadoCursor);
      ids = incremental.ids;
      cursor = incremental.siguiente
        ? JSON.stringify({
            tipo: 'HISTORIA',
            pagina: incremental.siguiente,
            historyId: estadoCursor,
          })
        : incremental.cursor;
    } catch (error) {
      if (!(error instanceof RespuestaProveedor) || error.status !== 404) throw error;
      const pagina = await idsInicialesGmail(credencial.accessToken, desde);
      ids = pagina.ids;
      if (pagina.siguiente) {
        cursor = JSON.stringify({
          tipo: 'INICIAL',
          pagina: pagina.siguiente,
          desde: (desde ?? new Date(Date.now() - 30 * 86_400_000)).toISOString(),
        });
        historicoCompleto = false;
      }
    }
  } else {
    const pagina = await idsInicialesGmail(credencial.accessToken, desde);
    ids = pagina.ids;
    if (pagina.siguiente) {
      cursor = JSON.stringify({
        tipo: 'INICIAL',
        pagina: pagina.siguiente,
        desde: (desde ?? new Date(Date.now() - 30 * 86_400_000)).toISOString(),
      });
      historicoCompleto = false;
    }
  }

  const mensajes: MensajeRemoto[] = [];
  for (let indice = 0; indice < ids.length; indice += 10) {
    mensajes.push(
      ...(await Promise.all(
        ids.slice(indice, indice + 10).map((id) => mensajeGmail(id, credencial.accessToken)),
      )),
    );
  }
  if (!cursor) {
    const perfil = perfilGmailSchema.parse(
      await json(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        credencial.accessToken,
      ),
    );
    cursor = perfil.historyId;
  }
  return { mensajes, cursor, historicoCompleto };
}

interface CursoresGraph {
  inbox?: string;
  sentitems?: string;
}

function leerCursoresGraph(cursor: string | null): CursoresGraph {
  if (!cursor) return {};
  try {
    return z
      .object({ inbox: z.string().url().optional(), sentitems: z.string().url().optional() })
      .parse(JSON.parse(cursor));
  } catch {
    return {};
  }
}

async function deltaGraph(
  carpeta: 'inbox' | 'sentitems',
  cursor: string | undefined,
  accessToken: string,
  desde: Date | null,
): Promise<{ ids: string[]; cursor: string; completo: boolean }> {
  const inicial = new URL(
    `https://graph.microsoft.com/v1.0/me/mailFolders/${carpeta}/messages/delta`,
  );
  inicial.searchParams.set('$select', 'id');
  inicial.searchParams.set('$top', '100');
  const fecha = desde ?? new Date(Date.now() - 30 * 86_400_000);
  inicial.searchParams.set('$filter', `receivedDateTime ge ${fecha.toISOString()}`);
  let siguiente = cursor ?? inicial.toString();
  const ids: string[] = [];
  let cursorNuevo = siguiente;
  let completo = false;
  for (let pagina = 0; pagina < 5; pagina += 1) {
    const lote = deltaGraphSchema.parse(await json(siguiente, accessToken));
    ids.push(...lote.value.filter((item) => !item['@removed']).map((item) => item.id));
    cursorNuevo = lote['@odata.nextLink'] ?? lote['@odata.deltaLink'] ?? cursorNuevo;
    if (!lote['@odata.nextLink']) {
      completo = Boolean(lote['@odata.deltaLink']);
      break;
    }
    siguiente = lote['@odata.nextLink'];
  }
  return { ids, cursor: cursorNuevo, completo };
}

async function mensajeGraph(
  id: string,
  direccion: MensajeRemoto['direccion'],
  accessToken: string,
): Promise<MensajeRemoto> {
  const respuesta = await peticion(
    `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(id)}/$value`,
    accessToken,
  );
  return { remotoId: id, direccion, raw: Buffer.from(await respuesta.arrayBuffer()) };
}

async function sincronizarGraph(
  buzon: BuzonParaSincronizar,
  credencial: CredencialOAuth,
  desde: Date | null,
): Promise<{ mensajes: MensajeRemoto[]; cursor: string; historicoCompleto: boolean }> {
  const cursores = leerCursoresGraph(buzon.cursorSincronizacion);
  const [entrada, salida] = await Promise.all([
    deltaGraph('inbox', cursores.inbox, credencial.accessToken, desde),
    deltaGraph('sentitems', cursores.sentitems, credencial.accessToken, desde),
  ]);
  const mensajes: MensajeRemoto[] = [];
  for (const [ids, direccion] of [
    [entrada.ids, 'ENTRANTE'],
    [salida.ids, 'SALIENTE'],
  ] as const) {
    for (let indice = 0; indice < ids.length; indice += 10) {
      mensajes.push(
        ...(await Promise.all(
          ids
            .slice(indice, indice + 10)
            .map((id) => mensajeGraph(id, direccion, credencial.accessToken)),
        )),
      );
    }
  }
  return {
    mensajes,
    cursor: JSON.stringify({ inbox: entrada.cursor, sentitems: salida.cursor }),
    historicoCompleto: entrada.completo && salida.completo,
  };
}

export async function obtenerLoteRemoto(
  buzon: BuzonParaSincronizar,
  historicoDesde: Date | null,
): Promise<LoteSincronizacion> {
  const credencial = await credencialVigente(buzon);
  const lote =
    buzon.tipo === 'GOOGLE_FUNCIONAL'
      ? await sincronizarGmail(buzon, credencial, historicoDesde)
      : await sincronizarGraph(buzon, credencial, historicoDesde);
  return { ...lote, credencial };
}
