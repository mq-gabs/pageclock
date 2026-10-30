import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { createTestUser } from '../test/auth';
import { createTestDb } from '../test/db';
import type { Db } from './client';
import { authTokens, books, readingSessions, users } from './schema';

function insertBook(db: Db, totalPages = 100, userId = createTestUser(db).id) {
  return db.insert(books).values({ userId, title: 'T', author: 'A', totalPages }).returning().get();
}

function insertSession(db: Db, book: { id: string; userId: string }, startPage = 1) {
  return db
    .insert(readingSessions)
    .values({
      userId: book.userId,
      bookId: book.id,
      startedAt: new Date(),
      startPage,
      source: 'manual',
    })
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
    insertSession(db, book);
    db.delete(books).where(eq(books.id, book.id)).run();
    expect(db.select().from(readingSessions).all()).toHaveLength(0);
  });

  it('deletes books, sessions and tokens when their user is deleted', () => {
    const db = createTestDb();
    const book = insertBook(db);
    insertSession(db, book);
    db.insert(authTokens)
      .values({ tokenHash: 'h', userId: book.userId, expiresAt: new Date() })
      .run();
    db.delete(users).where(eq(users.id, book.userId)).run();
    expect(db.select().from(books).all()).toHaveLength(0);
    expect(db.select().from(readingSessions).all()).toHaveLength(0);
    expect(db.select().from(authTokens).all()).toHaveLength(0);
  });

  it('rejects sessions for unknown books and books for unknown users', () => {
    const db = createTestDb();
    const userId = createTestUser(db).id;
    expect(() => insertSession(db, { id: 'missing', userId })).toThrow(/FOREIGN KEY/);
    expect(() => insertBook(db, 100, 'missing')).toThrow(/FOREIGN KEY/);
  });

  it('keeps nicks unique', () => {
    const db = createTestDb();
    createTestUser(db, { nick: 'same' });
    expect(() => createTestUser(db, { nick: 'same' })).toThrow(/UNIQUE/);
  });

  it('enforces column rules with check constraints', () => {
    const db = createTestDb();
    const userId = createTestUser(db).id;
    expect(() => insertBook(db, 0, userId)).toThrow(/CHECK/);
    expect(() => insertBook(db, 10001, userId)).toThrow(/CHECK/);
    expect(() =>
      db.insert(books).values({ userId, title: '', author: 'A', totalPages: 1 }).run(),
    ).toThrow(/CHECK/);
    expect(() => insertSession(db, insertBook(db, 100, userId), 0)).toThrow(/CHECK/);
    expect(() => createTestUser(db, { nick: 'ab' })).toThrow(/CHECK/);
    expect(() => createTestUser(db, { name: '' })).toThrow(/CHECK/);
  });
});
