import { describe, expect, it } from 'vitest';
import { listBooksQuerySchema } from './books';

describe('listBooksQuerySchema', () => {
  it('accepts an empty query', () => {
    expect(listBooksQuerySchema.parse({})).toEqual({});
  });

  it('accepts a known status and trims q', () => {
    expect(listBooksQuerySchema.parse({ status: 'reading', q: '  dune ' })).toEqual({
      status: 'reading',
      q: 'dune',
    });
  });

  it('treats empty values as no filter', () => {
    expect(listBooksQuerySchema.parse({ status: '', q: '' })).toEqual({});
  });

  it('rejects an unknown status', () => {
    expect(listBooksQuerySchema.safeParse({ status: 'abandoned' }).success).toBe(false);
  });
});
