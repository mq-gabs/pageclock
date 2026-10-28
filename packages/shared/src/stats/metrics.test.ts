import { describe, expect, it } from 'vitest';
import { session } from '../test-utils';
import { readingSpeed, sessionMinutes, sessionPages, totals } from './metrics';
import { sessions } from './fixtures';

describe('metrics', () => {
  const s = session({
    start: '2026-10-28T02:30:00Z',
    end: '2026-10-28T03:15:00Z',
    startPage: 40,
    endPage: 70,
  });

  it('pages read = end page − start page', () => {
    expect(sessionPages({ startPage: 40, endPage: 70 })).toBe(30);
  });

  it('minutes = end time − start time', () => {
    expect(sessionMinutes({ ...s, endedAt: s.endedAt! })).toBe(45);
  });

  it('minutes leave out paused time', () => {
    expect(
      sessionMinutes({ startedAt: s.startedAt, endedAt: s.endedAt!, pausedSeconds: 15 * 60 }),
    ).toBe(30);
  });

  it('never returns negative minutes', () => {
    expect(
      sessionMinutes({ startedAt: s.startedAt, endedAt: s.endedAt!, pausedSeconds: 3600 }),
    ).toBe(0);
  });

  it('speed = pages ÷ minutes × 60', () => {
    expect(readingSpeed(30, 45)).toBe(40);
    expect(readingSpeed(85, 125)).toBeCloseTo(40.8);
    expect(readingSpeed(0, 0)).toBeNull();
    expect(readingSpeed(10, 0)).toBeNull();
  });
});

describe('totals', () => {
  it('is empty with no sessions', () => {
    expect(totals([])).toEqual({ pages: 0, minutes: 0, sessions: 0, speed: null });
  });

  it('sums completed sessions and skips the running timer', () => {
    // 100 + 50 + 40 + 30 + 15 pages; 120 + 60 + 60 + 45 + 20 minutes
    expect(totals(sessions)).toEqual({
      pages: 235,
      minutes: 305,
      sessions: 5,
      speed: (235 / 305) * 60,
    });
  });
});
