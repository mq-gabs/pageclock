import type { SessionRecord } from '../rules/types';
import type { DateKey } from '../schemas/stats';
import { addDays, daysBetween } from './dates';
import { readingDays } from './daily';

export interface Streaks {
  /** Consecutive reading days ending today, or ending yesterday if today has no reading yet. */
  current: number;
  /** First day of the current streak; null when there is none. */
  currentSince: DateKey | null;
  longest: number;
  /** First and last day of the longest streak (the most recent one on a tie). */
  longestFrom: DateKey | null;
  longestTo: DateKey | null;
  lastReadingDay: DateKey | null;
}

export function streaks(
  sessions: readonly SessionRecord[],
  options: { today: DateKey; timeZone: string },
): Streaks {
  const days = readingDays(sessions, options.timeZone).filter((d) => d <= options.today);
  let longest = 0;
  let longestFrom: DateKey | null = null;
  let longestTo: DateKey | null = null;
  let run = 0;
  let runFrom: DateKey | null = null;
  let previous: DateKey | undefined;
  for (const day of days) {
    if (previous !== undefined && daysBetween(previous, day) === 1) {
      run++;
    } else {
      run = 1;
      runFrom = day;
    }
    if (run >= longest) {
      longest = run;
      longestFrom = runFrom;
      longestTo = day;
    }
    previous = day;
  }

  const last = days.at(-1) ?? null;
  const alive = last === options.today || last === addDays(options.today, -1);
  return {
    current: alive ? run : 0,
    currentSince: alive ? runFrom : null,
    longest,
    longestFrom,
    longestTo,
    lastReadingDay: last,
  };
}
