import { describe, expect, it } from 'vitest';
import { bestDay, byMonth, daily, heatLevel, readingDays } from './daily';
import { session } from '../test-utils';
import { sessions, TZ } from './fixtures';

describe('daily', () => {
  it('returns every day in range, including days without reading', () => {
    expect(daily(sessions, { from: '2026-10-19', to: '2026-10-21', timeZone: TZ })).toEqual([
      // D: 00:00 UTC Oct 20 is 21:00 Oct 19
      {
        date: '2026-10-19',
        pages: 50,
        minutes: 60,
        sessions: 1,
        books: [{ bookId: 'b2', pages: 50, minutes: 60 }],
      },
      { date: '2026-10-20', pages: 0, minutes: 0, sessions: 0, books: [] },
      { date: '2026-10-21', pages: 0, minutes: 0, sessions: 0, books: [] },
    ]);
  });

  it('counts a session that crosses midnight on its local start date', () => {
    const days = daily(sessions, { from: '2026-10-26', to: '2026-10-28', timeZone: TZ });
    expect(days.map(({ books: _, ...d }) => d)).toEqual([
      { date: '2026-10-26', pages: 40, minutes: 60, sessions: 1 },
      { date: '2026-10-27', pages: 30, minutes: 45, sessions: 1 }, // B: 23:30–00:15
      { date: '2026-10-28', pages: 15, minutes: 20, sessions: 1 }, // C; running R is ignored
    ]);
  });

  it('groups by UTC date if asked, which moves the late sessions', () => {
    const utc = daily(sessions, { from: '2026-10-26', to: '2026-10-28', timeZone: 'UTC' });
    expect(utc.map((d) => d.pages)).toEqual([40, 0, 45]);
  });

  it('works with no sessions', () => {
    expect(daily([], { from: '2026-10-01', to: '2026-10-02', timeZone: TZ })).toEqual([
      { date: '2026-10-01', pages: 0, minutes: 0, sessions: 0, books: [] },
      { date: '2026-10-02', pages: 0, minutes: 0, sessions: 0, books: [] },
    ]);
  });

  it('splits each day by book, most pages first, adding up a book’s sessions', () => {
    const day = '2026-10-10T';
    const [stat] = daily(
      [
        session({ bookId: 'a', start: `${day}12:00:00Z`, startPage: 1, endPage: 10 }), // 10 p, 30 min
        session({ bookId: 'b', start: `${day}13:00:00Z`, startPage: 1, endPage: 25 }), // 25 p
        session({ bookId: 'a', start: `${day}15:00:00Z`, startPage: 11, endPage: 30 }), // 20 p
        session({ bookId: 'c', start: `${day}16:00:00Z`, end: null, endPage: null }), // running
      ],
      { from: '2026-10-10', to: '2026-10-10', timeZone: TZ },
    );
    expect(stat).toEqual({
      date: '2026-10-10',
      pages: 55,
      minutes: 90,
      sessions: 3,
      books: [
        { bookId: 'a', pages: 30, minutes: 60 },
        { bookId: 'b', pages: 25, minutes: 30 },
      ],
    });
  });
});

describe('readingDays', () => {
  it('lists local dates with a completed session, sorted and unique', () => {
    expect(readingDays(sessions, TZ)).toEqual([
      '2026-09-30',
      '2026-10-19',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
    expect(readingDays([], TZ)).toEqual([]);
  });
});

describe('heatLevel', () => {
  it('uses the calendar buckets 0, 1–44, 45–59, 60–79, 80+', () => {
    expect([0, 1, 44, 45, 59, 60, 79, 80, 500].map(heatLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
});

describe('bestDay', () => {
  it('picks the day with the most pages, the earliest on a tie', () => {
    const days = daily(sessions, { from: '2026-10-19', to: '2026-10-28', timeZone: TZ });
    expect(bestDay(days)).toMatchObject({ date: '2026-10-19', pages: 50 });
    const tie = [
      { date: '2026-10-01', pages: 20, minutes: 30, sessions: 1 },
      { date: '2026-10-02', pages: 20, minutes: 10, sessions: 1 },
    ];
    expect(bestDay(tie)?.date).toBe('2026-10-01');
  });

  it('is null when nothing was read', () => {
    expect(bestDay([])).toBeNull();
    expect(bestDay(daily([], { from: '2026-10-01', to: '2026-10-03', timeZone: TZ }))).toBeNull();
  });
});

describe('byMonth', () => {
  it('adds up the days of each month, in order', () => {
    const days = daily(sessions, { from: '2026-09-01', to: '2026-11-30', timeZone: TZ });
    expect(byMonth(days)).toEqual([
      {
        month: '2026-09',
        pages: 100,
        minutes: 120,
        sessions: 1,
        books: [{ bookId: 'b2', pages: 100, minutes: 120 }],
      },
      {
        month: '2026-10',
        pages: 135,
        minutes: 185,
        sessions: 4,
        books: [
          { bookId: 'book-1', pages: 85, minutes: 125 }, // A + B + C
          { bookId: 'b2', pages: 50, minutes: 60 }, // D
        ],
      },
      { month: '2026-11', pages: 0, minutes: 0, sessions: 0, books: [] },
    ]);
  });

  it('keeps extra book fields, like the API’s titles, without changing the days', () => {
    const book = (pages: number) => ({ bookId: 'x', title: 'Dune', pages, minutes: pages });
    const days = [
      { date: '2026-10-01', pages: 10, minutes: 10, sessions: 1, books: [book(10)] },
      { date: '2026-10-02', pages: 5, minutes: 5, sessions: 1, books: [book(5)] },
    ];
    expect(byMonth(days)[0]?.books).toEqual([book(15)]);
    expect(days[0]?.books[0]?.pages).toBe(10);
  });
});
