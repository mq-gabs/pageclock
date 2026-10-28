import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestDb } from '../test/db';
import type { Db } from './client';
import { books, readingSessions } from './schema';

function insertBook(db: Db, totalPages = 100) {
  return db.insert(books).values({ title: 'T', author: 'A', totalPages }).returning().get();
}

function insertSession(db: Db, bookId: string, startPage = 0) {
  return db
    .insert(readingSessions)
    .values({ bookId, startedAt: new Date(), startPage, source: 'manual' })
    .run();
}

describe('schema', () => {
  it('defaults new books to want_to_read with timestamps', () => {
    const book = insertBook(createTestDb());
    expect(book.status).toBe('want_to_read');
    expect(book.createdAt).toBeInstanceOf(Date);
    expect(book.finishedAt).toBeNull();
  });

  it('deletes sessions when their book is deleted', () => {
    const db = createTestDb();
    const book = insertBook(db);
    insertSession(db, book.id);
    db.delete(books).where(eq(books.id, book.id)).run();
    expect(db.select().from(readingSessions).all()).toHaveLength(0);
  });

  it('rejects sessions for unknown books', () => {
    expect(() => insertSession(createTestDb(), 'missing')).toThrow(/FOREIGN KEY/);
  });

  it('enforces column rules with check constraints', () => {
    const db = createTestDb();
    expect(() => insertBook(db, 0)).toThrow(/CHECK/);
    expect(() => insertBook(db, 10001)).toThrow(/CHECK/);
    expect(() => db.insert(books).values({ title: '', author: 'A', totalPages: 1 }).run()).toThrow(
      /CHECK/,
    );
    expect(() => insertSession(db, insertBook(db).id, -1)).toThrow(/CHECK/);
  });
});
