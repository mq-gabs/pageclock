import { describe, expect, it } from 'vitest';
import { draft, session } from '../test-utils';
import { checkSession } from './check-session';

const now = new Date('2026-10-28T15:00:00Z');
const prev = session({ start: '2026-10-19T20:00:00Z', startPage: 0, endPage: 174 });
const otherBook = session({
  bookId: 'book-2',
  start: '2026-10-20T20:00:00Z',
  startPage: 0,
  endPage: 300,
});

describe('checkSession', () => {
  it('returns errors, warnings and the suggested start page together', () => {
    const result = checkSession(
      draft({
        start: '2026-10-21T20:00:00Z',
        end: '2026-10-21T21:00:00Z',
        startPage: 180,
        endPage: 600,
      }),
      [prev, otherBook],
      { totalPages: 476, now },
    );
    expect(result.errors.map((e) => e.code)).toEqual(['end_page_above_total']);
    expect(result.warnings.map((w) => w.code)).toEqual(['page_gap_before']);
    expect(result.suggestedStartPage).toBe(174);
  });

  it('is clean for a session that continues the book', () => {
    const result = checkSession(
      draft({
        start: '2026-10-21T20:00:00Z',
        end: '2026-10-21T21:00:00Z',
        startPage: 174,
        endPage: 200,
      }),
      [prev, otherBook],
      { totalPages: 476, now },
    );
    expect(result).toEqual({ errors: [], warnings: [], suggestedStartPage: 174 });
  });
});
