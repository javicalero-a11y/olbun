import { afterEach, describe, expect, it, vi } from 'vitest';

import { parseServerEnv, resetServerEnvCache, serverEnv } from './env';

const valid = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://olbun:olbun@localhost:5433/olbun',
} satisfies Record<string, string | undefined>;

describe('parseServerEnv', () => {
  it('accepts a minimal valid environment and applies defaults', () => {
    const env = parseServerEnv(valid);

    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(env.APP_URL).toBe('http://localhost:3000');
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
    resetServerEnvCache();

    const first = serverEnv();

    expect(first.DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(serverEnv()).toBe(first);
  });

  it('re-reads process.env after the cache is reset', () => {
    vi.stubEnv('DATABASE_URL', valid.DATABASE_URL);
    resetServerEnvCache();
    const first = serverEnv();

    vi.stubEnv('DATABASE_URL', 'postgresql://other@localhost:5433/other');
    resetServerEnvCache();

    expect(serverEnv()).not.toBe(first);
    expect(serverEnv().DATABASE_URL).toContain('other');
  });

  it('throws when the real environment is invalid', () => {
    vi.stubEnv('DATABASE_URL', '');
    resetServerEnvCache();

    expect(() => serverEnv()).toThrowError(/DATABASE_URL/);
  });
});
