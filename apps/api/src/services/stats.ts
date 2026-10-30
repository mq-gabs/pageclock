import { and, eq, gte, inArray, isNotNull, lt, type SQL } from 'drizzle-orm';
import {
  addDays,
  APP_TIME_ZONE,
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
import type { Db } from '../db/client';
import { books, readingSessions } from '../db/schema';
import { toRecord } from './sessions';

/**
 * Completed sessions, optionally only those that may start on a local date in `from … to`.
 * Rule 8: the grouping by local date happens in TypeScript; the SQL filter only narrows the
 * rows, with a day of margin on each side because local dates are within a day of UTC.
 */
function completedSessions(
  db: Db,
  userId: string,
  range?: { from: DateKey; to: DateKey },
): SessionRecord[] {
  const conditions: SQL[] = [
    eq(readingSessions.userId, userId),
    isNotNull(readingSessions.endedAt),
  ];
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
  userId: string,
  query: StatsSummaryQuery,
  now = new Date(),
  timeZone: string = APP_TIME_ZONE,
): StatsSummaryResponse {
  const today = toDateKey(now, timeZone);
  const date = query.date ?? today;
  const sessions = completedSessions(db, userId, {
    from: previousPeriodRange(query.period, date).from,
    to: periodRange(query.period, date).to,
  });
  return { ...summary(sessions, { period: query.period, date, timeZone, today }), today };
}

export function getDaily(
  db: Db,
  userId: string,
  query: StatsDailyQuery,
  timeZone: string = APP_TIME_ZONE,
): StatsDailyResponse {
  const days = daily(completedSessions(db, userId, query), { ...query, timeZone });
  const ids = [...new Set(days.flatMap((d) => d.books.map((b) => b.bookId)))];
  const titles = new Map(
    ids.length === 0
      ? []
      : db
          .select({ id: books.id, title: books.title })
          .from(books)
          .where(inArray(books.id, ids))
          .all()
          .map((b) => [b.id, b.title]),
  );
  return {
    days: days.map((d) => ({
      ...d,
      books: d.books.map((b) => ({ ...b, title: titles.get(b.bookId) ?? '' })),
    })),
  };
}

export function getStreaks(
  db: Db,
  userId: string,
  now = new Date(),
  timeZone: string = APP_TIME_ZONE,
): StatsStreaksResponse {
  const today = toDateKey(now, timeZone);
  return { ...streaks(completedSessions(db, userId), { today, timeZone }), today };
}
