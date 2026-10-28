import { describe, expect, it } from 'vitest';
import { session } from '../test-utils';
import { suggestStartPage } from './suggest-start-page';

const at = new Date('2026-10-20T12:00:00Z');

describe('suggestStartPage', () => {
  it('returns 0 for a book without sessions', () => {
    expect(suggestStartPage([], at)).toBe(0);
  });

  it('returns the end page of the latest session started before `at`, in any input order', () => {
    const sessions = [
      session({ start: '2026-10-18T20:00:00Z', startPage: 50, endPage: 120 }),
      session({ start: '2026-10-10T20:00:00Z', startPage: 0, endPage: 50 }),
      session({ start: '2026-10-19T20:00:00Z', startPage: 120, endPage: 174 }),
    ];
    expect(suggestStartPage(sessions, at)).toBe(174);
  });

  it('ignores sessions that start at or after `at`', () => {
    const sessions = [
      session({ start: '2026-10-19T20:00:00Z', endPage: 100 }),
      session({ start: '2026-10-20T12:00:00Z', startPage: 100, endPage: 150 }),
      session({ start: '2026-10-21T20:00:00Z', startPage: 150, endPage: 200 }),
    ];
    expect(suggestStartPage(sessions, at)).toBe(100);
  });

  it('returns 0 when every session starts later', () => {
    expect(suggestStartPage([session({ start: '2026-10-21T20:00:00Z', endPage: 30 })], at)).toBe(0);
  });

  it('skips the session being edited', () => {
    const editing = session({ start: '2026-10-19T20:00:00Z', startPage: 40, endPage: 90 });
    const sessions = [session({ start: '2026-10-18T20:00:00Z', endPage: 40 }), editing];
    expect(suggestStartPage(sessions, at, { excludeId: editing.id })).toBe(40);
  });

  it('skips a running timer, which has no end page', () => {
    const sessions = [
      session({ start: '2026-10-18T20:00:00Z', endPage: 40 }),
      session({ start: '2026-10-20T11:00:00Z', end: null, startPage: 40, endPage: null }),
    ];
    expect(suggestStartPage(sessions, at)).toBe(40);
  });
});
