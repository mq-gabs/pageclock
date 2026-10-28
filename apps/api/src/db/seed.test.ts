import { TZDate } from '@date-fns/tz';
import { asc, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db';
import { books, readingSessions } from './schema';
import { seed } from './seed';

const now = new Date('2026-10-28T15:00:00Z');
const db = createTestDb();

beforeAll(() => {
  seed(db, now, 'America/Fortaleza');
});

describe('seed', () => {
  it('inserts the demo books with every status', () => {
    const rows = db.select().from(books).all();
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((b) => b.status))).toEqual(
      new Set(['want_to_read', 'reading', 'finished']),
    );
  });

  it('is repeatable: seeding again replaces the data', () => {
    const counts = seed(db, now, 'America/Fortaleza');
    expect(db.select().from(books).all()).toHaveLength(counts.books);
    expect(db.select().from(readingSessions).all()).toHaveLength(counts.sessions);
  });

  it('keeps every book consistent with its sessions', () => {
    for (const book of db.select().from(books).all()) {
      const sessions = db
        .select()
        .from(readingSessions)
        .where(eq(readingSessions.bookId, book.id))
        .orderBy(asc(readingSessions.startedAt))
        .all();

      let page = 0;
      for (const s of sessions) {
        expect(s.startPage).toBe(page); // no gaps or overlaps
        expect(s.endPage).not.toBeNull();
        expect(s.endPage!).toBeGreaterThan(s.startPage);
        expect(s.endPage!).toBeLessThanOrEqual(book.totalPages);
        expect(s.endedAt!.getTime()).toBeGreaterThan(s.startedAt.getTime());
        expect(s.endedAt!.getTime()).toBeLessThanOrEqual(now.getTime());
        page = s.endPage!;
      }

      if (book.status === 'want_to_read') expect(sessions).toHaveLength(0);
      if (book.status === 'reading') expect(sessions.length).toBeGreaterThan(0);
      if (book.status === 'finished') {
        expect(page).toBe(book.totalPages);
        expect(book.finishedAt).toEqual(sessions.at(-1)?.endedAt);
      } else {
        expect(book.finishedAt).toBeNull();
      }
    }
  });

  it('never overlaps sessions in time', () => {
    const sessions = db
      .select()
      .from(readingSessions)
      .orderBy(asc(readingSessions.startedAt))
      .all();
    for (let i = 1; i < sessions.length; i++) {
      expect(sessions[i]!.startedAt.getTime()).toBeGreaterThanOrEqual(
        sessions[i - 1]!.endedAt!.getTime(),
      );
    }
  });

  it('has a reading book whose latest session ends on page 174', () => {
    const [book] = db.select().from(books).where(eq(books.title, 'Project Hail Mary')).all();
    const sessions = db
      .select()
      .from(readingSessions)
      .where(eq(readingSessions.bookId, book!.id))
      .all();
    expect(Math.max(...sessions.map((s) => s.endPage ?? 0))).toBe(174);
  });

  it('includes a session that crosses midnight in America/Fortaleza', () => {
    const crossing = db
      .select()
      .from(readingSessions)
      .all()
      .filter((s) => {
        const start = new TZDate(s.startedAt, 'America/Fortaleza');
        const end = new TZDate(s.endedAt!, 'America/Fortaleza');
        return start.getDate() !== end.getDate();
      });
    expect(crossing).toHaveLength(1);
  });
});
