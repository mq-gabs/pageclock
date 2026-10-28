import { isCompleted, type SessionRecord } from '../rules/types';
import type { DateKey } from '../schemas/stats';
import { eachDay, toDateKey, type DateRange } from './dates';
import { sessionMinutes, sessionPages } from './metrics';

export interface DailyStat {
  date: DateKey;
  pages: number;
  minutes: number;
  sessions: number;
}

/**
 * Pages and minutes per local day from `from` to `to` (inclusive), zero days included.
 * A session counts on the local date it started, even if it ends after midnight.
 */
export function daily(
  sessions: readonly SessionRecord[],
  options: DateRange & { timeZone: string },
): DailyStat[] {
  const byDay = new Map<DateKey, DailyStat>(
    eachDay(options.from, options.to).map((date) => [
      date,
      { date, pages: 0, minutes: 0, sessions: 0 },
    ]),
  );
  for (const s of sessions) {
    if (!isCompleted(s)) continue;
    const day = byDay.get(toDateKey(s.startedAt, options.timeZone));
    if (!day) continue;
    day.pages += sessionPages(s);
    day.minutes += sessionMinutes(s);
    day.sessions++;
  }
  return [...byDay.values()];
}

/** The local dates with at least one completed session, sorted. */
export function readingDays(sessions: readonly SessionRecord[], timeZone: string): DateKey[] {
  const days = new Set<DateKey>();
  for (const s of sessions) if (isCompleted(s)) days.add(toDateKey(s.startedAt, timeZone));
  return [...days].sort();
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

/** Calendar shade for a day: 0, 1–44, 45–59, 60–79, 80+ pages. */
export function heatLevel(pages: number): HeatLevel {
  if (pages >= 80) return 4;
  if (pages >= 60) return 3;
  if (pages >= 45) return 2;
  if (pages >= 1) return 1;
  return 0;
}
