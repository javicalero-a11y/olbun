import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetServerEnvCache } from '@/lib/env';
import {
  ErrorProveedorCorreo,
  hashOAuth,
  identidadBuzon,
  intercambiarCodigo,
  nuevoSecretoOAuth,
  proveedorCorreoConfigurado,
  refrescarToken,
  urlAutorizacion,
} from './oauth';

describe('OAuth de buzones', () => {
  beforeEach(() => {
    vi.stubEnv('APP_URL', 'https://demo.olbun.es');
    vi.stubEnv('GOOGLE_MAIL_CLIENT_ID', 'google-mail-id');
    vi.stubEnv('GOOGLE_MAIL_CLIENT_SECRET', 'google-mail-secret');
    vi.stubEnv('MICROSOFT_MAIL_CLIENT_ID', 'microsoft-mail-id');
    vi.stubEnv('MICROSOFT_MAIL_CLIENT_SECRET', 'microsoft-mail-secret');
    vi.stubEnv('MICROSOFT_MAIL_TENANT_ID', 'organizations');
    resetServerEnvCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it('Google pide sólo lectura, acceso offline, PKCE y callback exacto', () => {
    const url = new URL(urlAutorizacion('GOOGLE', 'estado-secreto', 'verificador-secreto'));
    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/gmail.readonly',
    );
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('state')).toBe('estado-secreto');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://demo.olbun.es/api/buzones/oauth/google/callback',
    );
    expect(url.toString()).not.toContain('google-mail-secret');
  });

  it('Microsoft limita el consentimiento a organizaciones y Mail.Read', () => {
    const url = new URL(urlAutorizacion('MICROSOFT', 'state', 'verifier'));
    expect(url.pathname).toContain('/organizations/oauth2/v2.0/authorize');
    expect(url.searchParams.get('scope')?.split(' ')).toEqual([
      'offline_access',
      'User.Read',
      'Mail.Read',
    ]);
    expect(url.searchParams.get('response_mode')).toBe('query');
    expect(url.toString()).not.toContain('microsoft-mail-secret');
  });

  it('el state se guarda como una huella irreversible y estable', () => {
    expect(hashOAuth('estado')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashOAuth('estado')).toBe(hashOAuth('estado'));
    expect(hashOAuth('estado')).not.toBe(hashOAuth('otro'));
    expect(nuevoSecretoOAuth()).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('sólo anuncia los dos proveedores cuando tienen el par de credenciales', () => {
    expect(proveedorCorreoConfigurado('GOOGLE')).toBe(true);
    expect(proveedorCorreoConfigurado('MICROSOFT')).toBe(true);
  });

  it('no anuncia un proveedor a medio configurar', () => {
    vi.stubEnv('GOOGLE_MAIL_CLIENT_SECRET', '');
    resetServerEnvCache();
    expect(() => proveedorCorreoConfigurado('GOOGLE')).toThrow(/GOOGLE_MAIL_CLIENT_ID/);
  });

  it('intercambia un código de Google y normaliza caducidad, refresh y scopes', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 3600,
          scope: 'scope-a scope-b',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const token = await intercambiarCodigo('GOOGLE', 'codigo', 'verificador');
    expect(token).toMatchObject({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      scopes: ['scope-a', 'scope-b'],
    });
    expect(token.expiraEn.getTime()).toBeGreaterThan(Date.now());
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rechaza una autorización que no permite continuar sin la persona presente', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'access', expires_in: 3600 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(intercambiarCodigo('GOOGLE', 'codigo', 'verificador')).rejects.toThrow(
      /acceso offline/,
    );
  });

  it('refresca Microsoft aunque no rote el refresh token ni devuelva scopes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'access-2', expires_in: 1800 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(refrescarToken('MICROSOFT', 'refresh-anterior')).resolves.toMatchObject({
      accessToken: 'access-2',
      refreshToken: undefined,
      scopes: [],
    });
  });

  it('lee la identidad de Gmail y usa el UPN si Microsoft no devuelve mail', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ emailAddress: 'Contratos@Example.com', historyId: 'hist-1' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ id: 'entra-1', mail: null, userPrincipalName: 'Legal@Example.com' }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(identidadBuzon('GOOGLE', 'access')).resolves.toEqual({
      cuentaId: 'contratos@example.com',
      direccion: 'contratos@example.com',
      cursorInicial: 'hist-1',
    });
    await expect(identidadBuzon('MICROSOFT', 'access')).resolves.toEqual({
      cuentaId: 'entra-1',
      direccion: 'legal@example.com',
    });
  });

  it('marca que hay que reconectar cuando el proveedor revoca la identidad', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const resultado = identidadBuzon('GOOGLE', 'revocado').catch((error: unknown) => error);
    await expect(resultado).resolves.toBeInstanceOf(ErrorProveedorCorreo);
    await expect(resultado).resolves.toMatchObject({ requiereReconectar: true });
  });
});
