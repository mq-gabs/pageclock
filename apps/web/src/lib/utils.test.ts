import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins classes and drops falsy values', () => {
    const hidden = false;
    expect(cn('a', hidden && 'b', undefined, 'c')).toBe('a c');
  });

  it('lets later Tailwind classes win', () => {
    expect(cn('px-2 bg-surface', 'px-4')).toBe('bg-surface px-4');
  });

  it('keeps a size token next to a color token', () => {
    expect(cn('text-label', 'text-muted')).toBe('text-label text-muted');
    expect(cn('text-label', 'text-meta')).toBe('text-meta');
  });
});
