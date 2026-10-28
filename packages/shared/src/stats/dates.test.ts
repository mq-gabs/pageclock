import { describe, expect, it } from 'vitest';
import { dateKeySchema } from '../schemas/stats';
import {
  addDays,
  daysBetween,
  eachDay,
  periodRange,
  previousPeriodRange,
  toDateKey,
} from './dates';

describe('toDateKey', () => {
  it('uses the local date in America/Fortaleza (UTC−3)', () => {
    expect(toDateKey(new Date('2026-10-28T02:59:59Z'), 'America/Fortaleza')).toBe('2026-10-27');
    expect(toDateKey(new Date('2026-10-28T03:00:00Z'), 'America/Fortaleza')).toBe('2026-10-28');
  });

  it('differs from the UTC date near midnight', () => {
    const instant = new Date('2026-10-28T01:00:00Z');
    expect(toDateKey(instant, 'UTC')).toBe('2026-10-28');
    expect(toDateKey(instant, 'America/Fortaleza')).toBe('2026-10-27');
  });

  it('crosses year boundaries', () => {
    expect(toDateKey(new Date('2027-01-01T02:00:00Z'), 'America/Fortaleza')).toBe('2026-12-31');
  });
});

describe('day arithmetic', () => {
  it('adds days across months, years and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('counts days between dates', () => {
    expect(daysBetween('2026-10-26', '2026-11-01')).toBe(6);
    expect(daysBetween('2026-11-01', '2026-10-26')).toBe(-6);
  });

  it('lists each day inclusively', () => {
    expect(eachDay('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ]);
    expect(eachDay('2026-10-30', '2026-10-30')).toEqual(['2026-10-30']);
    expect(eachDay('2026-10-30', '2026-10-29')).toEqual([]);
  });
});

describe('periodRange', () => {
  it('starts weeks on Monday', () => {
    const week = { from: '2026-10-26', to: '2026-11-01' };
    expect(periodRange('week', '2026-10-26')).toEqual(week); // Monday
    expect(periodRange('week', '2026-10-28')).toEqual(week); // Wednesday
    expect(periodRange('week', '2026-11-01')).toEqual(week); // Sunday
  });

  it('handles a week spanning two years', () => {
    expect(periodRange('week', '2026-01-01')).toEqual({ from: '2025-12-29', to: '2026-01-04' });
  });

  it('covers whole months, including leap Februaries', () => {
    expect(periodRange('month', '2026-10-28')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodRange('month', '2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('covers whole years', () => {
    expect(periodRange('year', '2026-10-28')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('finds the previous period', () => {
    expect(previousPeriodRange('week', '2026-10-28')).toEqual({
      from: '2026-10-19',
      to: '2026-10-25',
    });
    expect(previousPeriodRange('month', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
    expect(previousPeriodRange('month', '2026-03-31')).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(previousPeriodRange('year', '2026-10-28')).toEqual({
      from: '2025-01-01',
      to: '2025-12-31',
    });
  });
});

describe('dateKeySchema', () => {
  it('accepts real dates only', () => {
    expect(dateKeySchema.safeParse('2028-02-29').success).toBe(true);
    expect(dateKeySchema.safeParse('2026-02-29').success).toBe(false);
    expect(dateKeySchema.safeParse('2026-13-01').success).toBe(false);
    expect(dateKeySchema.safeParse('2026-1-01').success).toBe(false);
    expect(dateKeySchema.safeParse('yesterday').success).toBe(false);
  });
});
