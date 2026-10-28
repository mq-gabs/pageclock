import { describe, expect, it } from 'vitest';
import { draft, session } from '../test-utils';
import { checkPages } from './check-pages';

// prev: Oct 19 20:00–20:30, pages 0 → 174.  next: Oct 23 20:00–20:30, pages 220 → 250.
const prev = session({ start: '2026-10-19T20:00:00Z', startPage: 0, endPage: 174 });
const next = session({ start: '2026-10-23T20:00:00Z', startPage: 220, endPage: 250 });
const at = { start: '2026-10-21T20:00:00Z', end: '2026-10-21T21:00:00Z' };

describe('checkPages: previous session', () => {
  it('is quiet when the session continues where the previous one ended', () => {
    expect(checkPages(draft({ ...at, startPage: 174, endPage: 200 }), [prev])).toEqual([]);
  });

  it('warns about a gap and suggests the previous end page', () => {
    const [w, ...rest] = checkPages(draft({ ...at, startPage: 180, endPage: 200 }), [prev]);
    expect(rest).toEqual([]);
    expect(w).toMatchObject({
      code: 'page_gap_before',
      suggestion: { startPage: 174 },
      sessionId: prev.id,
    });
    expect(w?.message).toContain('Pages 175–180 are skipped');
  });

  it('names a single skipped page', () => {
    const [w] = checkPages(draft({ ...at, startPage: 175, endPage: 200 }), [prev]);
    expect(w?.message).toContain('Page 175 is skipped');
  });

  it('warns about an overlap', () => {
    const [w] = checkPages(draft({ ...at, startPage: 170, endPage: 200 }), [prev]);
    expect(w).toMatchObject({ code: 'page_overlap_before', suggestion: { startPage: 174 } });
    expect(w?.message).toContain('Pages 171–174 are counted twice');
  });

  it('has nothing to compare for the first session of a book', () => {
    expect(checkPages(draft({ ...at, startPage: 30, endPage: 60 }), [])).toEqual([]);
  });

  it('only uses the closest previous session', () => {
    const older = session({ start: '2026-10-10T20:00:00Z', startPage: 0, endPage: 100 });
    expect(checkPages(draft({ ...at, startPage: 174, endPage: 200 }), [older, prev])).toEqual([]);
  });

  it('omits the suggestion when it would leave no pages to read', () => {
    const [w] = checkPages(draft({ ...at, startPage: 100, endPage: 150 }), [prev]);
    expect(w?.code).toBe('page_overlap_before');
    expect(w?.suggestion).toBeUndefined();
  });

  it('treats a session with the same start time as the previous one', () => {
    const tie = session({
      start: at.start,
      end: '2026-10-21T20:10:00Z',
      startPage: 0,
      endPage: 50,
    });
    const warnings = checkPages(draft({ ...at, startPage: 60, endPage: 80 }), [tie]);
    expect(warnings.map((w) => w.code)).toEqual(['page_gap_before', 'time_overlap']);
  });
});

describe('checkPages: next session', () => {
  it('is quiet when the session ends where the next one starts', () => {
    expect(checkPages(draft({ ...at, startPage: 174, endPage: 220 }), [prev, next])).toEqual([]);
  });

  it('warns about a gap before the next session', () => {
    const [w] = checkPages(draft({ ...at, startPage: 174, endPage: 210 }), [prev, next]);
    expect(w).toMatchObject({
      code: 'page_gap_after',
      suggestion: { endPage: 220 },
      sessionId: next.id,
    });
    expect(w?.message).toContain('Pages 211–220 are skipped');
  });

  it('warns about an overlap with the next session', () => {
    const [w] = checkPages(draft({ ...at, startPage: 174, endPage: 230 }), [prev, next]);
    expect(w).toMatchObject({ code: 'page_overlap_after', suggestion: { endPage: 220 } });
    expect(w?.message).toContain('Pages 221–230 are counted twice');
  });

  it('reports problems on both sides', () => {
    const warnings = checkPages(draft({ ...at, startPage: 180, endPage: 230 }), [prev, next]);
    expect(warnings.map((w) => w.code)).toEqual(['page_gap_before', 'page_overlap_after']);
  });
});

describe('checkPages: editing and other books', () => {
  it('ignores the session being edited', () => {
    const editing = session({ start: at.start, end: at.end, startPage: 174, endPage: 200 });
    const edited = draft({ ...at, id: editing.id, startPage: 174, endPage: 210 });
    expect(checkPages(edited, [prev, editing])).toEqual([]);
  });

  it('only compares pages with the same book', () => {
    const otherBook = session({
      bookId: 'book-2',
      start: '2026-10-20T20:00:00Z',
      startPage: 0,
      endPage: 9,
    });
    expect(checkPages(draft({ ...at, startPage: 174, endPage: 200 }), [prev, otherBook])).toEqual(
      [],
    );
  });

  it('skips the page check against a running timer', () => {
    const running = session({
      start: '2026-10-21T10:00:00Z',
      end: null,
      startPage: 174,
      endPage: null,
    });
    expect(checkPages(draft({ ...at, startPage: 180, endPage: 200 }), [running])).toEqual([]);
  });
});

describe('checkPages: time overlap', () => {
  const base = { startPage: 174, endPage: 200 };

  it('warns when another book’s session overlaps, suggesting a later start', () => {
    const other = session({
      bookId: 'book-2',
      start: '2026-10-21T19:30:00Z',
      end: '2026-10-21T20:15:00Z',
    });
    const [w] = checkPages(draft({ ...at, ...base }), [prev, other]);
    expect(w).toMatchObject({
      code: 'time_overlap',
      sessionId: other.id,
      suggestion: { startedAt: '2026-10-21T20:15:00.000Z' },
    });
  });

  it('suggests an earlier end when the other session starts inside', () => {
    const other = session({
      bookId: 'book-2',
      start: '2026-10-21T20:45:00Z',
      end: '2026-10-21T22:00:00Z',
    });
    const [w] = checkPages(draft({ ...at, ...base }), [prev, other]);
    expect(w?.suggestion).toEqual({ endedAt: '2026-10-21T20:45:00.000Z' });
  });

  it('gives no suggestion when the session sits inside another one', () => {
    const other = session({
      bookId: 'book-2',
      start: '2026-10-21T19:00:00Z',
      end: '2026-10-21T22:00:00Z',
    });
    const [w] = checkPages(draft({ ...at, ...base }), [prev, other]);
    expect(w?.code).toBe('time_overlap');
    expect(w?.suggestion).toBeUndefined();
  });

  it('does not count sessions that only touch', () => {
    const before = session({ bookId: 'book-2', start: '2026-10-21T19:00:00Z', end: at.start });
    const after = session({ bookId: 'book-2', start: at.end, end: '2026-10-21T22:00:00Z' });
    expect(checkPages(draft({ ...at, ...base }), [prev, before, after])).toEqual([]);
  });

  it('treats a running timer as lasting until now', () => {
    const running = session({
      bookId: 'book-2',
      start: '2026-10-21T20:30:00Z',
      end: null,
      endPage: null,
    });
    const d = draft({ ...at, ...base });
    expect(checkPages(d, [prev, running])).toEqual([]);
    expect(checkPages(d, [prev, running], { now: new Date('2026-10-21T20:40:00Z') })[0]?.code).toBe(
      'time_overlap',
    );
  });
});
