import { isCompleted, type SessionRecord } from '../rules/types';
import type { DateKey } from '../schemas/stats';
import { eachDay, toDateKey, type DateRange } from './dates';
import { sessionMinutes, sessionPages } from './metrics';

/** Pages and minutes one book got in a day (or month). */
export interface BookStat {
  bookId: string;
  pages: number;
  minutes: number;
}

export interface DailyStat {
  date: DateKey;
  pages: number;
  minutes: number;
  sessions: number;
  /** The books read that day, most pages first. */
  books: BookStat[];
}

/** Most pages first, then most minutes; `bookId` keeps ties stable. */
const byPagesRead = (a: BookStat, b: BookStat) =>
  b.pages - a.pages || b.minutes - a.minutes || a.bookId.localeCompare(b.bookId);

/** Adds `stat` to the entry for its book in `books` (or a copy of it as a new entry). */
function addBookStat<B extends BookStat>(books: Map<string, B>, stat: B) {
  const entry = books.get(stat.bookId);
  if (entry) {
    entry.pages += stat.pages;
    entry.minutes += stat.minutes;
  } else {
    books.set(stat.bookId, { ...stat });
  }
}

/**
 * Pages and minutes per local day from `from` to `to` (inclusive), zero days included, with
 * the same split per book. A session counts on the local date it started, even if it ends
 * after midnight.
 */
export function daily(
  sessions: readonly SessionRecord[],
  options: DateRange & { timeZone: string },
): DailyStat[] {
  const byDay = new Map(
    eachDay(options.from, options.to).map((date) => [
      date,
      { date, pages: 0, minutes: 0, sessions: 0, books: new Map<string, BookStat>() },
    ]),
  );
  for (const s of sessions) {
    if (!isCompleted(s)) continue;
    const day = byDay.get(toDateKey(s.startedAt, options.timeZone));
    if (!day) continue;
    const pages = sessionPages(s);
    const minutes = sessionMinutes(s);
    day.pages += pages;
    day.minutes += minutes;
    day.sessions++;
    addBookStat(day.books, { bookId: s.bookId, pages, minutes });
  }
  return [...byDay.values()].map((day) => ({
    ...day,
    books: [...day.books.values()].sort(byPagesRead),
  }));
}

/** The day (or month) with the most pages, the earliest on a tie; null when nothing was read. */
export function bestDay<T extends { pages: number }>(days: readonly T[]): T | null {
  let best: T | null = null;
  for (const day of days) if (day.pages > (best?.pages ?? 0)) best = day;
  return best;
}

export interface MonthlyStat<B extends BookStat = BookStat> {
  /** `yyyy-MM` */
  month: string;
  pages: number;
  minutes: number;
  sessions: number;
  /** The books read that month, most pages first. */
  books: B[];
}

/**
 * Daily stats added up per calendar month, in order (for the Year chart). Book entries keep
 * any extra fields of the first day they appear on (the API adds `title`).
 */
export function byMonth<B extends BookStat>(
  days: readonly (Omit<DailyStat, 'books'> & { books: readonly B[] })[],
): MonthlyStat<B>[] {
  const months = new Map<string, Omit<MonthlyStat<B>, 'books'> & { books: Map<string, B> }>();
  for (const day of days) {
    const month = day.date.slice(0, 7);
    let total = months.get(month);
    if (!total) {
      total = { month, pages: 0, minutes: 0, sessions: 0, books: new Map() };
      months.set(month, total);
    }
    total.pages += day.pages;
    total.minutes += day.minutes;
    total.sessions += day.sessions;
    for (const book of day.books) addBookStat(total.books, book);
  }
  return [...months.values()].map((m) => ({
    ...m,
    books: [...m.books.values()].sort(byPagesRead),
  }));
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
