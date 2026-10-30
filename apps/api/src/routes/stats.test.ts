import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiErrorSchema,
  listBooksResponseSchema,
  statsDailyResponseSchema,
  statsStreaksResponseSchema,
  statsSummaryResponseSchema,
} from '@reading-tracker/shared';
import { createApp } from '../app';
import type { Db } from '../db/client';
import { seed } from '../db/seed';
import { authedAgent, createTestUser } from '../test/auth';
import { createTestDb } from '../test/db';

/**
 * Wed Oct 28 2026, 12:00 in America/Fortaleza. Seed sessions "N days ago" land on these local
 * dates (pages / minutes), worked out by hand from the seed table:
 *
 * September — The Left Hand of Darkness: 18 (38/50), 19 (45/60), 21 (52/75), 22 (30/45),
 *   24 (66/90), 25 (28/40, 23:40 → crosses midnight), 27 (45/70) = 304 pages, 430 min, 7 days.
 * October — Project Hail Mary: 16 (32/45), 17 (20/30), 19 (46/60), 22 (26/40), 24 (24/35),
 *   25 (14/25), 27 (12/20); Thinking, Fast and Slow: 2 (18/40), 4 (14/30), 9 (25/50),
 *   26 (22/45) = 253 pages, 420 min, 11 sessions on 11 days.
 */
const now = new Date('2026-10-28T15:00:00Z');

let db: Db;
let api: ReturnType<typeof authedAgent>;
let userId: string;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now });
  db = createTestDb();
  userId = seed(db, now, 'America/Fortaleza').userId;
  api = authedAgent(createApp({ db }), db, userId);
});

afterEach(() => {
  vi.useRealTimers();
});

const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;

describe('GET /api/stats/summary', () => {
  it('matches the hand-computed October against September', async () => {
    const res = await api.get('/api/stats/summary?period=month&date=2026-10-15');
    expect(res.status).toBe(200);
    const s = statsSummaryResponseSchema.parse(res.body);
    expect(s.today).toBe('2026-10-28');
    expect(s.current).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
      pages: 253,
      minutes: 420,
      sessions: 11,
      speed: (253 / 420) * 60, // 36.1 p/h
      readingDays: 11,
      books: 2, // Project Hail Mary and Thinking, Fast and Slow
    });
    expect(s.previous).toMatchObject({
      pages: 304,
      minutes: 430,
      sessions: 7,
      readingDays: 7,
      books: 1, // The Left Hand of Darkness
    });
    expect(s.previous.speed).toBeCloseTo(42.42, 2);
    expect(s.daysSoFar).toBe(28);
    // −16.8%, −2.3%, +57.1%, −14.8%
    expect(s.change).toEqual({ pages: -17, minutes: -2, readingDays: 57, speed: -15, books: 100 });
  });

  it('defaults to the period containing today', async () => {
    const s = statsSummaryResponseSchema.parse(
      (await api.get('/api/stats/summary?period=week')).body,
    );
    // Mon Oct 26 – Sun Nov 1: Oct 26 (22/45) and Oct 27 (12/20).
    expect(s.current).toMatchObject({
      from: '2026-10-26',
      pages: 34,
      minutes: 65,
      readingDays: 2,
      books: 2, // Thinking on Oct 26, Project Hail Mary on Oct 27
    });
    // Oct 19, 22, 24, 25, all Project Hail Mary.
    expect(s.previous).toMatchObject({ pages: 110, minutes: 160, readingDays: 4, books: 1 });
    expect(s.daysSoFar).toBe(3);
  });

  it('counts every day of a past period', async () => {
    const s = statsSummaryResponseSchema.parse(
      (await api.get('/api/stats/summary?period=month&date=2026-09-01')).body,
    );
    expect(s.current).toMatchObject({ pages: 304, readingDays: 7 });
    expect(s.daysSoFar).toBe(30);
  });

  it('ignores a running timer', async () => {
    const { books } = listBooksResponseSchema.parse((await api.get('/api/books')).body);
    const id = books.find((b) => b.title === 'Project Hail Mary')!.id;
    await api.post('/api/timer/start').send({ bookId: id }).expect(201);
    vi.setSystemTime(now.getTime() + 30 * 60_000);
    const s = statsSummaryResponseSchema.parse(
      (await api.get('/api/stats/summary?period=month')).body,
    );
    expect(s.current).toMatchObject({ pages: 253, minutes: 420, sessions: 11 });
  });

  it('rejects a missing or unknown period and a bad date', async () => {
    const missing = await api.get('/api/stats/summary');
    expect(missing.status).toBe(400);
    expect(errorOf(missing.body).fields?.period).toBeDefined();
    expect((await api.get('/api/stats/summary?period=day')).status).toBe(400);
    const bad = await api.get('/api/stats/summary?period=month&date=2026-02-30');
    expect(bad.status).toBe(400);
    expect(errorOf(bad.body).fields?.date).toEqual(['Not a real calendar date']);
  });
});

describe('GET /api/stats/daily', () => {
  it('returns every local day in the range', async () => {
    const res = await api.get('/api/stats/daily?from=2026-10-24&to=2026-10-28');
    expect(res.status).toBe(200);
    const { days } = statsDailyResponseSchema.parse(res.body);
    expect(days.map(({ books: _, ...d }) => d)).toEqual([
      { date: '2026-10-24', pages: 24, minutes: 35, sessions: 1 },
      { date: '2026-10-25', pages: 14, minutes: 25, sessions: 1 },
      { date: '2026-10-26', pages: 22, minutes: 45, sessions: 1 },
      { date: '2026-10-27', pages: 12, minutes: 20, sessions: 1 },
      { date: '2026-10-28', pages: 0, minutes: 0, sessions: 0 },
    ]);
    // Each day lists its books with their titles.
    expect(days.map((d) => d.books.map((b) => [b.title, b.pages, b.minutes]))).toEqual([
      [['Project Hail Mary', 24, 35]],
      [['Project Hail Mary', 14, 25]],
      [['Thinking, Fast and Slow', 22, 45]],
      [['Project Hail Mary', 12, 20]],
      [],
    ]);
  });

  it('counts a session that crosses midnight on its start date', async () => {
    const { days } = statsDailyResponseSchema.parse(
      (await api.get('/api/stats/daily?from=2026-09-25&to=2026-09-26')).body,
    );
    expect(days.map((d) => d.pages)).toEqual([28, 0]); // 23:40 → 00:20
  });

  it('adds up to the month summary', async () => {
    const { days } = statsDailyResponseSchema.parse(
      (await api.get('/api/stats/daily?from=2026-10-01&to=2026-10-31')).body,
    );
    expect(days).toHaveLength(31);
    expect(days.reduce((sum, d) => sum + d.pages, 0)).toBe(253);
    expect(days.filter((d) => d.pages > 0)).toHaveLength(11);
  });

  it('validates the range', async () => {
    expect((await api.get('/api/stats/daily?from=2026-10-01')).status).toBe(400);
    const reversed = await api.get('/api/stats/daily?from=2026-10-05&to=2026-10-01');
    expect(reversed.status).toBe(400);
    expect(errorOf(reversed.body).fields?.to).toBeDefined();
    const long = await api.get('/api/stats/daily?from=2025-01-01&to=2026-01-02');
    expect(long.status).toBe(400);
    expect((await api.get('/api/stats/daily?from=2024-01-01&to=2024-12-31')).status).toBe(200);
  });
});

describe('GET /api/stats/streaks', () => {
  it('finds the current run (Oct 24–27) and the longest', async () => {
    const res = await api.get('/api/stats/streaks');
    expect(res.status).toBe(200);
    expect(statsStreaksResponseSchema.parse(res.body)).toEqual({
      today: '2026-10-28',
      current: 4,
      currentSince: '2026-10-24',
      longest: 4,
      longestFrom: '2026-10-24',
      longestTo: '2026-10-27',
      lastReadingDay: '2026-10-27',
    });
  });

  it('is empty without sessions', async () => {
    db = createTestDb();
    api = authedAgent(createApp({ db }), db, createTestUser(db).id);
    expect(
      statsStreaksResponseSchema.parse((await api.get('/api/stats/streaks')).body),
    ).toMatchObject({ current: 0, longest: 0, currentSince: null, lastReadingDay: null });
  });
});
