import { describe, expect, it } from 'vitest';

import { cn } from './utils';

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('lets a later Tailwind utility win over an earlier conflicting one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('drops falsy values', () => {
    expect(cn('px-2', false, undefined, null, '')).toBe('px-2');
  });

  it('resolves conditional objects and arrays', () => {
    expect(cn(['text-sm', { 'font-bold': true, italic: false }])).toBe('text-sm font-bold');
  });

  it('returns an empty string when given nothing', () => {
    expect(cn()).toBe('');
  });
});
