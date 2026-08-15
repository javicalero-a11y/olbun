import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseServerEnv, resetServerEnvCache, serverEnv } from './env';

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://olbun_app:secret@localhost:5433/olbun',
  DIRECT_DATABASE_URL: 'postgresql://olbun:olbun@localhost:5433/olbun',
  AUTH_SECRET: 'x'.repeat(32),
  ENCRYPTION_KEY: Buffer.alloc(32, 4).toString('base64'),
} satisfies Record<string, string | undefined>;

describe('parseServerEnv', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const env = parseServerEnv(valid);

    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.APP_URL).toBe('http://localhost:3100');
    expect(env.LOG_LEVEL).toBe('info');
  });

  it('defaults NODE_ENV to development when absent', () => {
    const { NODE_ENV: _omitted, ...withoutNodeEnv } = valid;

    expect(parseServerEnv(withoutNodeEnv).NODE_ENV).toBe('development');
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _omitted, ...withoutDatabase } = valid;

    expect(() => parseServerEnv(withoutDatabase)).toThrowError(/DATABASE_URL/);
  });

  it('throws when DATABASE_URL is empty', () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: '' })).toThrowError(/DATABASE_URL/);
  });

  it('throws when APP_URL is not a URL', () => {
    expect(() => parseServerEnv({ ...valid, APP_URL: 'not-a-url' })).toThrowError(/APP_URL/);
  });

  it('throws when LOG_LEVEL is outside the allowed set', () => {
    expect(() => parseServerEnv({ ...valid, LOG_LEVEL: 'verbose' })).toThrowError(/LOG_LEVEL/);
  });

  it('rejects malformed current and retired encryption keys', () => {
    expect(() => parseServerEnv({ ...valid, ENCRYPTION_KEY: 'y'.repeat(44) })).toThrowError(
      /ENCRYPTION_KEY/,
    );
    expect(() =>
      parseServerEnv({ ...valid, ENCRYPTION_PREVIOUS_KEYS: 'not-a-key' }),
    ).toThrowError(/ENCRYPTION_PREVIOUS_KEYS/);
  });

  it('accepts multiple valid retired encryption keys during a rotation', () => {
    const claves = [Buffer.alloc(32, 5), Buffer.alloc(32, 6)]
      .map((clave) => clave.toString('base64'))
      .join(',');

    expect(
      parseServerEnv({ ...valid, ENCRYPTION_PREVIOUS_KEYS: claves }).ENCRYPTION_PREVIOUS_KEYS,
    ).toBe(claves);
  });

  it('labels a root-level failure rather than printing an empty path', () => {
    const notAnObject = 'DATABASE_URL=...' as unknown as Record<string, string | undefined>;

    expect(() => parseServerEnv(notAnObject)).toThrowError(/\(root\)/);
  });

  it('reports every invalid variable in one message', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'staging', APP_URL: 'nope' })).toThrowError(
      /NODE_ENV[\s\S]*APP_URL/,
    );
  });
});

describe('serverEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetServerEnvCache();
  });

  it('parses process.env and caches the result', () => {
    vi.stubEnv('DATABASE_URL', valid.DATABASE_URL);
    vi.stubEnv('DIRECT_DATABASE_URL', valid.DIRECT_DATABASE_URL);
    vi.stubEnv('AUTH_SECRET', valid.AUTH_SECRET);
    vi.stubEnv('ENCRYPTION_KEY', valid.ENCRYPTION_KEY);
    resetServerEnvCache();

    const first = serverEnv();

    expect(first.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(serverEnv()).toBe(first);
  });

  it('re-reads process.env after the cache is reset', () => {
    vi.stubEnv('DATABASE_URL', valid.DATABASE_URL);
    vi.stubEnv('DIRECT_DATABASE_URL', valid.DIRECT_DATABASE_URL);
    vi.stubEnv('AUTH_SECRET', valid.AUTH_SECRET);
    vi.stubEnv('ENCRYPTION_KEY', valid.ENCRYPTION_KEY);
    resetServerEnvCache();
    const first = serverEnv();

    vi.stubEnv('DATABASE_URL', 'postgresql://other@localhost:5433/other');
    resetServerEnvCache();

    expect(serverEnv()).not.toBe(first);
    expect(serverEnv().DATABASE_URL).toContain('other');
  });

  it('throws when the real environment is invalid', () => {
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DIRECT_DATABASE_URL', valid.DIRECT_DATABASE_URL);
    vi.stubEnv('AUTH_SECRET', valid.AUTH_SECRET);
    vi.stubEnv('ENCRYPTION_KEY', valid.ENCRYPTION_KEY);
    resetServerEnvCache();

    expect(() => serverEnv()).toThrowError(/DATABASE_URL/);
  });
});
