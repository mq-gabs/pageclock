import { and, gte, isNotNull, lt, type SQL } from 'drizzle-orm';
import {
  addDays,
  daily,
  previousPeriodRange,
  periodRange,
  streaks,
  summary,
  toDateKey,
  type DateKey,
  type SessionRecord,
  type StatsDailyQuery,
  type StatsDailyResponse,
  type StatsStreaksResponse,
  type StatsSummaryQuery,
  type StatsSummaryResponse,
} from '@reading-tracker/shared';
import { config } from '../config';
import type { Db } from '../db/client';
import { readingSessions } from '../db/schema';
import { toRecord } from './sessions';

/**
 * Completed sessions, optionally only those that may start on a local date in `from … to`.
 * Rule 8: the grouping by local date happens in TypeScript; the SQL filter only narrows the
 * rows, with a day of margin on each side because local dates are within a day of UTC.
 */
function completedSessions(db: Db, range?: { from: DateKey; to: DateKey }): SessionRecord[] {
  const conditions: SQL[] = [isNotNull(readingSessions.endedAt)];
  if (range) {
    conditions.push(
      gte(readingSessions.startedAt, new Date(`${addDays(range.from, -1)}T00:00:00Z`)),
      lt(readingSessions.startedAt, new Date(`${addDays(range.to, 2)}T00:00:00Z`)),
    );
  }
  return db
    .select()
    .from(readingSessions)
    .where(and(...conditions))
    .all()
    .map(toRecord);
}

export function getSummary(
  db: Db,
  query: StatsSummaryQuery,
  now = new Date(),
  timeZone = config.appTimezone,
): StatsSummaryResponse {
  const today = toDateKey(now, timeZone);
  const date = query.date ?? today;
  const sessions = completedSessions(db, {
    from: previousPeriodRange(query.period, date).from,
    to: periodRange(query.period, date).to,
  });
  return { ...summary(sessions, { period: query.period, date, timeZone, today }), today };
}

export function getDaily(
  db: Db,
  query: StatsDailyQuery,
  timeZone = config.appTimezone,
): StatsDailyResponse {
  return { days: daily(completedSessions(db, query), { ...query, timeZone }) };
}

export function getStreaks(
  db: Db,
  now = new Date(),
  timeZone = config.appTimezone,
): StatsStreaksResponse {
  const today = toDateKey(now, timeZone);
  return { ...streaks(completedSessions(db), { today, timeZone }), today };
}
