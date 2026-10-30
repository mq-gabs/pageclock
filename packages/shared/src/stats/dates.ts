import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import type { DateKey, StatsPeriod } from '../schemas/stats';

/**
 * Calendar math works on `yyyy-MM-dd` keys in UTC, so it is free of DST and offset bugs.
 * The time zone is only used to turn an instant into its local date.
 */

/** The app always groups days and shows times in UTC. */
export const APP_TIME_ZONE = 'UTC';

/** The local date of an instant in `timeZone`. */
export function toDateKey(instant: Date, timeZone: string): DateKey {
  return format(new TZDate(instant.getTime(), timeZone), 'yyyy-MM-dd');
}

function keyToUtc(key: DateKey): Date {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

const utcToKey = (date: Date): DateKey => date.toISOString().slice(0, 10);

export function addDays(key: DateKey, days: number): DateKey {
  const date = keyToUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return utcToKey(date);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return Math.round((keyToUtc(to).getTime() - keyToUtc(from).getTime()) / 86_400_000);
}

/** Every date from `from` to `to`, inclusive. Empty when `to` is before `from`. */
export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const days: DateKey[] = [];
  for (let key = from; key <= to; key = addDays(key, 1)) days.push(key);
  return days;
}

export interface DateRange {
  from: DateKey;
  to: DateKey;
}

/** The week (Monday–Sunday), month or year containing `date`. */
export function periodRange(period: StatsPeriod, date: DateKey): DateRange {
  const d = keyToUtc(date);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (period) {
    case 'week': {
      const from = addDays(date, -((d.getUTCDay() + 6) % 7));
      return { from, to: addDays(from, 6) };
    }
    case 'month':
      return {
        from: utcToKey(new Date(Date.UTC(y, m, 1))),
        to: utcToKey(new Date(Date.UTC(y, m + 1, 0))),
      };
    case 'year':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
  }
}

/** The period just before the one containing `date`. */
export function previousPeriodRange(period: StatsPeriod, date: DateKey): DateRange {
  return periodRange(period, addDays(periodRange(period, date).from, -1));
}
