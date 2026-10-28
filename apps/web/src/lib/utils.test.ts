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
});
