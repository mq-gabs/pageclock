import { describe, expect, it } from 'vitest';
import { createBookSchema, listBooksQuerySchema, updateBookSchema } from './books';

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

describe('createBookSchema', () => {
  it('trims text and accepts the limits', () => {
    expect(
      createBookSchema.parse({ title: ' Dune ', author: ' Frank Herbert ', totalPages: 1 }),
    ).toEqual({
      title: 'Dune',
      author: 'Frank Herbert',
      totalPages: 1,
    });
    expect(
      createBookSchema.safeParse({ title: 'x'.repeat(300), author: 'a', totalPages: 10000 })
        .success,
    ).toBe(true);
  });

  it('rejects blank text, long text and bad page counts', () => {
    const bad = [
      { title: '   ', author: 'a', totalPages: 10 },
      { title: 't', author: '', totalPages: 10 },
      { title: 'x'.repeat(301), author: 'a', totalPages: 10 },
      { title: 't', author: 'a', totalPages: 0 },
      { title: 't', author: 'a', totalPages: 10001 },
      { title: 't', author: 'a', totalPages: 12.5 },
      { title: 't', author: 'a', totalPages: Number.NaN },
      { title: 't', author: 'a' },
    ];
    for (const input of bad) expect(createBookSchema.safeParse(input).success).toBe(false);
  });
});

describe('updateBookSchema', () => {
  it('accepts any subset of fields', () => {
    expect(updateBookSchema.parse({ status: 'finished' })).toEqual({ status: 'finished' });
  });

  it('rejects an empty update', () => {
    expect(updateBookSchema.safeParse({}).success).toBe(false);
  });
});
