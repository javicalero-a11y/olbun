import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

import { serverEnv } from '@/lib/env';

export type ProveedorCorreo = 'GOOGLE' | 'MICROSOFT';

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
});

const perfilGoogleSchema = z.object({
  emailAddress: z.email(),
  historyId: z.string().optional(),
});
const perfilMicrosoftSchema = z.object({
  id: z.string().min(1),
  mail: z.email().nullable().optional(),
  userPrincipalName: z.email(),
});

export class ErrorProveedorCorreo extends Error {
  constructor(
    message: string,
    readonly requiereReconectar = false,
  ) {
    super(message);
    this.name = 'ErrorProveedorCorreo';
  }
}

interface ConfiguracionOAuth {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
}

export function proveedorCorreoConfigurado(proveedor: ProveedorCorreo): boolean {
  const env = serverEnv();
  return proveedor === 'GOOGLE'
    ? Boolean(env.GOOGLE_MAIL_CLIENT_ID && env.GOOGLE_MAIL_CLIENT_SECRET)
    : Boolean(env.MICROSOFT_MAIL_CLIENT_ID && env.MICROSOFT_MAIL_CLIENT_SECRET);
}

function configuracion(proveedor: ProveedorCorreo): ConfiguracionOAuth {
  const env = serverEnv();
  if (proveedor === 'GOOGLE' && env.GOOGLE_MAIL_CLIENT_ID && env.GOOGLE_MAIL_CLIENT_SECRET) {
    return {
      clientId: env.GOOGLE_MAIL_CLIENT_ID,
      clientSecret: env.GOOGLE_MAIL_CLIENT_SECRET,
      authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    };
  }

  if (
    proveedor === 'MICROSOFT' &&
    env.MICROSOFT_MAIL_CLIENT_ID &&
    env.MICROSOFT_MAIL_CLIENT_SECRET
  ) {
    const tenant = encodeURIComponent(env.MICROSOFT_MAIL_TENANT_ID);
    return {
      clientId: env.MICROSOFT_MAIL_CLIENT_ID,
      clientSecret: env.MICROSOFT_MAIL_CLIENT_SECRET,
      authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
      scopes: ['offline_access', 'User.Read', 'Mail.Read'],
    };
  }

  throw new ErrorProveedorCorreo(
    `${proveedor === 'GOOGLE' ? 'Google Workspace' : 'Microsoft 365'} no está configurado.`,
  );
}

export function nuevoSecretoOAuth(): string {
  return randomBytes(32).toString('base64url');
}

export function hashOAuth(valor: string): string {
  return createHash('sha256').update(valor).digest('hex');
}

function redirectUri(proveedor: ProveedorCorreo): string {
  const nombre = proveedor === 'GOOGLE' ? 'google' : 'microsoft';
  return new URL(`/api/buzones/oauth/${nombre}/callback`, serverEnv().APP_URL).toString();
}

export function urlAutorizacion(
  proveedor: ProveedorCorreo,
  state: string,
  pkceVerifier: string,
): string {
  const config = configuracion(proveedor);
  const url = new URL(config.authorizeUrl);
  const challenge = createHash('sha256').update(pkceVerifier).digest('base64url');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri(proveedor));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', config.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  if (proveedor === 'GOOGLE') {
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
  } else {
    url.searchParams.set('response_mode', 'query');
  }
  return url.toString();
}

async function pedirToken(
  proveedor: ProveedorCorreo,
  parametros: URLSearchParams,
): Promise<z.infer<typeof tokenSchema>> {
  const config = configuracion(proveedor);
  parametros.set('client_id', config.clientId);
  parametros.set('client_secret', config.clientSecret);
  if (proveedor === 'MICROSOFT' && !parametros.has('scope')) {
    parametros.set('scope', config.scopes.join(' '));
  }
  const respuesta = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: parametros,
    cache: 'no-store',
  });
  if (!respuesta.ok) {
    throw new ErrorProveedorCorreo(
      'El proveedor rechazó la autorización.',
      respuesta.status === 400,
    );
  }
  return tokenSchema.parse(await respuesta.json());
}

export interface CredencialOAuth {
  accessToken: string;
  refreshToken?: string | undefined;
  expiraEn: Date;
  scopes: string[];
}

function normalizarToken(token: z.infer<typeof tokenSchema>): CredencialOAuth {
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiraEn: new Date(Date.now() + token.expires_in * 1000),
    scopes: token.scope?.split(/\s+/).filter(Boolean) ?? [],
  };
}

export async function intercambiarCodigo(
  proveedor: ProveedorCorreo,
  code: string,
  pkceVerifier: string,
): Promise<CredencialOAuth> {
  const token = await pedirToken(
    proveedor,
    new URLSearchParams({
      code,
      code_verifier: pkceVerifier,
      redirect_uri: redirectUri(proveedor),
      grant_type: 'authorization_code',
    }),
  );
  if (!token.refresh_token) {
    throw new ErrorProveedorCorreo(
      'El proveedor no entregó acceso offline; vuelve a autorizar.',
    );
  }
  return normalizarToken(token);
}

export async function refrescarToken(
  proveedor: ProveedorCorreo,
  refreshToken: string,
): Promise<CredencialOAuth> {
  const token = await pedirToken(
    proveedor,
    new URLSearchParams({ refresh_token: refreshToken, grant_type: 'refresh_token' }),
  );
  return normalizarToken(token);
}

async function jsonAutorizado(url: string, accessToken: string): Promise<unknown> {
  const respuesta = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!respuesta.ok) {
    throw new ErrorProveedorCorreo(
      'No se ha podido leer la identidad del buzón.',
      respuesta.status === 401 || respuesta.status === 403,
    );
  }
  return respuesta.json();
}

export async function identidadBuzon(
  proveedor: ProveedorCorreo,
  accessToken: string,
): Promise<{ cuentaId: string; direccion: string; cursorInicial?: string | undefined }> {
  if (proveedor === 'GOOGLE') {
    const perfil = perfilGoogleSchema.parse(
      await jsonAutorizado(
        'https://gmail.googleapis.com/gmail/v1/users/me/profile',
        accessToken,
      ),
    );
    return {
      cuentaId: perfil.emailAddress.toLowerCase(),
      direccion: perfil.emailAddress.toLowerCase(),
      cursorInicial: perfil.historyId,
    };
  }

  const perfil = perfilMicrosoftSchema.parse(
    await jsonAutorizado(
      'https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName',
      accessToken,
    ),
  );
  return {
    cuentaId: perfil.id,
    direccion: (perfil.mail ?? perfil.userPrincipalName).toLowerCase(),
  };
}
