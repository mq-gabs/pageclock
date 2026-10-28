import type { SessionRecord } from '../rules/types';
import type { DateKey } from '../schemas/stats';
import { addDays, daysBetween } from './dates';
import { readingDays } from './daily';

export interface Streaks {
  /** Consecutive reading days ending today, or ending yesterday if today has no reading yet. */
  current: number;
  longest: number;
  lastReadingDay: DateKey | null;
}

export function streaks(
  sessions: readonly SessionRecord[],
  options: { today: DateKey; timeZone: string },
): Streaks {
  const days = readingDays(sessions, options.timeZone).filter((d) => d <= options.today);
  let longest = 0;
  let run = 0;
  let previous: DateKey | undefined;
  for (const day of days) {
    run = previous !== undefined && daysBetween(previous, day) === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = day;
  }

  const last = days.at(-1) ?? null;
  const current = last === options.today || last === addDays(options.today, -1) ? run : 0;
  return { current, longest, lastReadingDay: last };
}
