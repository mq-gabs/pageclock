import { describe, expect, it } from 'vitest';
import { summary } from './summary';
import { sessions, TZ } from './fixtures';

describe('summary', () => {
  it('sums the week (Mon Oct 26 – Sun Nov 1) and compares with the week before', () => {
    const s = summary(sessions, { period: 'week', date: '2026-10-28', timeZone: TZ });
    expect(s.current).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
      pages: 85, // A 40 + B 30 + C 15
      minutes: 125, // 60 + 45 + 20
      sessions: 3,
      speed: (85 / 125) * 60, // 40.8 pages/hour
      readingDays: 3,
    });
    expect(s.previous).toMatchObject({
      from: '2026-10-19',
      to: '2026-10-25',
      pages: 50,
      minutes: 60,
      readingDays: 1,
    });
    expect(s.change).toEqual({ pages: 70, minutes: 108, readingDays: 200, speed: -18 });
  });

  it('sums the month and compares with the previous month', () => {
    const s = summary(sessions, { period: 'month', date: '2026-10-05', timeZone: TZ });
    expect(s.current).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      pages: 135,
      minutes: 185,
      readingDays: 4,
    });
    // E starts 23:00 UTC Sep 30 = 20:00 local Sep 30, so it stays in September.
    expect(s.previous).toMatchObject({ pages: 100, minutes: 120, readingDays: 1, speed: 50 });
    expect(s.change.pages).toBe(35);
  });

  it('sums the year, with no change when the previous year is empty', () => {
    const s = summary(sessions, { period: 'year', date: '2026-10-28', timeZone: TZ });
    expect(s.current).toMatchObject({ pages: 235, minutes: 305, sessions: 5, readingDays: 5 });
    expect(s.previous).toMatchObject({
      pages: 0,
      minutes: 0,
      sessions: 0,
      speed: null,
      readingDays: 0,
    });
    expect(s.change).toEqual({ pages: null, minutes: null, readingDays: null, speed: null });
  });

  it('is all zeros without sessions', () => {
    const s = summary([], { period: 'week', date: '2026-10-28', timeZone: TZ });
    expect(s.current).toMatchObject({
      pages: 0,
      minutes: 0,
      sessions: 0,
      speed: null,
      readingDays: 0,
    });
  });
});
