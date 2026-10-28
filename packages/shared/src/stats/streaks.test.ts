import { describe, expect, it } from 'vitest';
import { session } from '../test-utils';
import { streaks } from './streaks';
import { sessions, TZ } from './fixtures';

/** A session at 20:00 local (23:00 UTC) on each given local date. */
const onDays = (...days: string[]) => days.map((d) => session({ start: `${d}T23:00:00Z` }));

describe('streaks', () => {
  it('is zero without sessions', () => {
    expect(streaks([], { today: '2026-10-28', timeZone: TZ })).toEqual({
      current: 0,
      longest: 0,
      lastReadingDay: null,
    });
  });

  it('counts the run ending today', () => {
    // Reading days: Sep 30, Oct 19, Oct 26, 27 (B at 23:30 local), 28.
    expect(streaks(sessions, { today: '2026-10-28', timeZone: TZ })).toEqual({
      current: 3,
      longest: 3,
      lastReadingDay: '2026-10-28',
    });
  });

  it('keeps the streak alive until today is over', () => {
    expect(streaks(sessions, { today: '2026-10-29', timeZone: TZ }).current).toBe(3);
    expect(streaks(sessions, { today: '2026-10-30', timeZone: TZ }).current).toBe(0);
  });

  it('only counts days up to today', () => {
    expect(streaks(sessions, { today: '2026-10-27', timeZone: TZ })).toEqual({
      current: 2,
      longest: 2,
      lastReadingDay: '2026-10-27',
    });
  });

  it('relies on local dates near midnight', () => {
    // In UTC, B lands on Oct 28 and A on Oct 26, leaving Oct 27 empty.
    expect(streaks(sessions, { today: '2026-10-28', timeZone: 'UTC' }).current).toBe(1);
  });

  it('tracks the longest run separately from the current one', () => {
    const data = onDays(
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-20',
      '2026-10-21',
    );
    expect(streaks(data, { today: '2026-10-21', timeZone: TZ })).toEqual({
      current: 2,
      longest: 4,
      lastReadingDay: '2026-10-21',
    });
  });

  it('counts several sessions on one day once, across month ends', () => {
    const data = [...onDays('2026-10-30', '2026-10-31', '2026-11-01'), ...onDays('2026-10-31')];
    expect(streaks(data, { today: '2026-11-01', timeZone: TZ }).current).toBe(3);
  });
});
