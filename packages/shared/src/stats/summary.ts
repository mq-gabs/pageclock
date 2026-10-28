import { isCompleted, type SessionRecord } from '../rules/types';
import type { DateKey, StatsPeriod } from '../schemas/stats';
import { daysBetween, periodRange, previousPeriodRange, toDateKey, type DateRange } from './dates';
import { totals, type Totals } from './metrics';

export interface PeriodTotals extends DateRange, Totals {
  readingDays: number;
}

export interface Summary {
  period: StatsPeriod;
  current: PeriodTotals;
  previous: PeriodTotals;
  /** Days of the current period up to `today` (all of them for a past period, 0 for a future one). */
  daysSoFar: number;
  /** Whole-percent change vs the previous period; null when the previous value is 0 or null. */
  change: {
    pages: number | null;
    minutes: number | null;
    readingDays: number | null;
    speed: number | null;
  };
}

function periodTotals(
  sessions: readonly SessionRecord[],
  range: DateRange,
  timeZone: string,
): PeriodTotals {
  const inRange: SessionRecord[] = [];
  const days = new Set<DateKey>();
  for (const s of sessions) {
    if (!isCompleted(s)) continue;
    const day = toDateKey(s.startedAt, timeZone);
    if (day < range.from || day > range.to) continue;
    inRange.push(s);
    days.add(day);
  }
  return { ...range, ...totals(inRange), readingDays: days.size };
}

function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function daysSoFar(range: DateRange, today: DateKey): number {
  if (today < range.from) return 0;
  return daysBetween(range.from, today < range.to ? today : range.to) + 1;
}

/**
 * Totals, average speed and reading days for the week/month/year containing `date`, compared
 * with the period before. `today` defaults to the end of the period.
 */
export function summary(
  sessions: readonly SessionRecord[],
  options: { period: StatsPeriod; date: DateKey; timeZone: string; today?: DateKey },
): Summary {
  const current = periodTotals(
    sessions,
    periodRange(options.period, options.date),
    options.timeZone,
  );
  const previous = periodTotals(
    sessions,
    previousPeriodRange(options.period, options.date),
    options.timeZone,
  );
  return {
    period: options.period,
    current,
    previous,
    daysSoFar: daysSoFar(current, options.today ?? current.to),
    change: {
      pages: percentChange(current.pages, previous.pages),
      minutes: percentChange(current.minutes, previous.minutes),
      readingDays: percentChange(current.readingDays, previous.readingDays),
      speed: percentChange(current.speed, previous.speed),
    },
  };
}
