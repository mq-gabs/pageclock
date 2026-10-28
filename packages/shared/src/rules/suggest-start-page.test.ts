import { describe, expect, it } from 'vitest';
import { session } from '../test-utils';
import { latestSessionBefore, suggestStartPage } from './suggest-start-page';

const at = new Date('2026-10-20T12:00:00Z');

describe('suggestStartPage', () => {
  it('returns page 1 for a book without sessions', () => {
    expect(suggestStartPage([], at, 500)).toBe(1);
  });

  it('returns the page after the latest earlier session’s end page, in any input order', () => {
    const sessions = [
      session({ start: '2026-10-18T20:00:00Z', startPage: 51, endPage: 120 }),
      session({ start: '2026-10-10T20:00:00Z', startPage: 1, endPage: 50 }),
      session({ start: '2026-10-19T20:00:00Z', startPage: 121, endPage: 174 }),
    ];
    expect(suggestStartPage(sessions, at, 500)).toBe(175);
  });

  it('ignores sessions that start at or after `at`', () => {
    const sessions = [
      session({ start: '2026-10-19T20:00:00Z', endPage: 100 }),
      session({ start: '2026-10-20T12:00:00Z', startPage: 101, endPage: 150 }),
      session({ start: '2026-10-21T20:00:00Z', startPage: 151, endPage: 200 }),
    ];
    expect(suggestStartPage(sessions, at, 500)).toBe(101);
  });

  it('returns page 1 when every session starts later', () => {
    const later = session({ start: '2026-10-21T20:00:00Z', endPage: 30 });
    expect(suggestStartPage([later], at, 500)).toBe(1);
  });

  it('skips the session being edited', () => {
    const editing = session({ start: '2026-10-19T20:00:00Z', startPage: 41, endPage: 90 });
    const sessions = [session({ start: '2026-10-18T20:00:00Z', endPage: 40 }), editing];
    expect(suggestStartPage(sessions, at, 500, { excludeId: editing.id })).toBe(41);
  });

  it('skips a running timer, which has no end page', () => {
    const sessions = [
      session({ start: '2026-10-18T20:00:00Z', endPage: 40 }),
      session({ start: '2026-10-20T11:00:00Z', end: null, startPage: 41, endPage: null }),
    ];
    expect(suggestStartPage(sessions, at, 500)).toBe(41);
  });

  it('stays on the last page once the book is finished', () => {
    const sessions = [session({ start: '2026-10-18T20:00:00Z', startPage: 401, endPage: 500 })];
    expect(suggestStartPage(sessions, at, 500)).toBe(500);
  });
});

describe('latestSessionBefore', () => {
  it('returns the session rule 1 takes the start page from', () => {
    const latest = session({ start: '2026-10-19T20:00:00Z', startPage: 121, endPage: 174 });
    const sessions = [session({ start: '2026-10-18T20:00:00Z', endPage: 120 }), latest];
    expect(latestSessionBefore(sessions, at)).toBe(latest);
  });

  it('is undefined without an earlier finished session', () => {
    expect(latestSessionBefore([], at)).toBeUndefined();
    const running = session({ start: '2026-10-20T11:00:00Z', end: null, endPage: null });
    expect(latestSessionBefore([running], at)).toBeUndefined();
  });
});
