import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import {
  bookProgress,
  progressPercent,
  readingDays,
  totals,
  type Book,
  type BookCounts,
  type BookDetail,
  type BookWithProgress,
  type CreateBookInput,
  type ListBooksQuery,
  type ListBooksResponse,
  type UpdateBookInput,
} from '@reading-tracker/shared';
import { config } from '../config';
import type { Db, DbOrTx } from '../db/client';
import { books, readingSessions, type BookRow } from '../db/schema';
import { HttpError } from '../middleware/errors';

export function toBook(row: BookRow): Book {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    totalPages: row.totalPages,
    status: row.status,
    finishedAt: row.finishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function withProgress(row: BookRow, endPages: readonly (number | null)[]): BookWithProgress {
  const progress = bookProgress(endPages.map((endPage) => ({ endPage })));
  return { ...toBook(row), progress, percent: progressPercent(progress, row.totalPages) };
}

/** End pages of every session, grouped by book. */
function endPagesByBook(db: DbOrTx, bookIds: string[]): Map<string, (number | null)[]> {
  const byBook = new Map<string, (number | null)[]>();
  if (bookIds.length === 0) return byBook;
  const rows = db
    .select({ bookId: readingSessions.bookId, endPage: readingSessions.endPage })
    .from(readingSessions)
    .where(inArray(readingSessions.bookId, bookIds))
    .all();
  for (const { bookId, endPage } of rows) {
    const list = byBook.get(bookId) ?? [];
    list.push(endPage);
    byBook.set(bookId, list);
  }
  return byBook;
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function searchCondition(q: string | undefined): SQL | undefined {
  if (!q) return undefined;
  const pattern = `%${escapeLike(q)}%`;
  return or(
    sql`${books.title} like ${pattern} escape '\\'`,
    sql`${books.author} like ${pattern} escape '\\'`,
  );
}

export function listBooks(db: Db, userId: string, query: ListBooksQuery): ListBooksResponse {
  const matching = db
    .select()
    .from(books)
    .where(and(eq(books.userId, userId), searchCondition(query.q)))
    .orderBy(desc(books.updatedAt), asc(books.title))
    .all();

  const counts: BookCounts = { all: matching.length, want_to_read: 0, reading: 0, finished: 0 };
  for (const row of matching) counts[row.status]++;

  const listed = query.status ? matching.filter((row) => row.status === query.status) : matching;
  const endPages = endPagesByBook(
    db,
    listed.map((row) => row.id),
  );
  return { books: listed.map((row) => withProgress(row, endPages.get(row.id) ?? [])), counts };
}

/** The user's book; another user's book is a 404 like a missing one. */
export function findBookRow(db: DbOrTx, userId: string, id: string): BookRow {
  const row = db
    .select()
    .from(books)
    .where(and(eq(books.id, id), eq(books.userId, userId)))
    .get();
  if (!row) throw new HttpError(404, 'not_found', 'Book not found');
  return row;
}

export function getBookWithProgress(db: DbOrTx, userId: string, id: string): BookWithProgress {
  return withProgress(findBookRow(db, userId, id), endPagesByBook(db, [id]).get(id) ?? []);
}

export function getBook(db: Db, userId: string, id: string): BookDetail {
  const row = findBookRow(db, userId, id);
  const sessions = db
    .select()
    .from(readingSessions)
    .where(eq(readingSessions.bookId, id))
    .orderBy(asc(readingSessions.startedAt))
    .all();
  const completed = sessions.filter((s) => s.endedAt !== null && s.endPage !== null);
  const sum = totals(sessions);

  return {
    book: withProgress(
      row,
      sessions.map((s) => s.endPage),
    ),
    stats: {
      pages: sum.pages,
      minutes: sum.minutes,
      sessions: sum.sessions,
      speed: sum.speed,
      readingDays: readingDays(sessions, config.appTimezone).length,
      firstReadAt: completed[0]?.startedAt.toISOString() ?? null,
      lastReadAt: completed.at(-1)?.startedAt.toISOString() ?? null,
    },
  };
}

export function createBook(db: Db, userId: string, input: CreateBookInput): BookWithProgress {
  const row = db
    .insert(books)
    .values({ ...input, userId })
    .returning()
    .get();
  return withProgress(row, []);
}

export function updateBook(
  db: Db,
  userId: string,
  id: string,
  input: UpdateBookInput,
  now = new Date(),
) {
  return db.transaction((tx) => {
    const row = findBookRow(tx, userId, id);
    const endPages = endPagesByBook(tx, [id]).get(id) ?? [];
    const progress = bookProgress(endPages.map((endPage) => ({ endPage })));

    if (input.totalPages !== undefined && input.totalPages < progress) {
      throw new HttpError(400, 'validation_error', 'Invalid request body', {
        totalPages: [`Sessions already reach page ${progress}`],
      });
    }

    let finishedAt = row.finishedAt;
    if (input.status === 'finished' && row.status !== 'finished') finishedAt = now;
    if (input.status && input.status !== 'finished') finishedAt = null;

    const updated = tx
      .update(books)
      .set({ ...input, finishedAt, updatedAt: now })
      .where(eq(books.id, id))
      .returning()
      .get();
    return withProgress(updated, endPages);
  });
}

export function deleteBook(db: Db, userId: string, id: string) {
  const deleted = db
    .delete(books)
    .where(and(eq(books.id, id), eq(books.userId, userId)))
    .returning({ id: books.id })
    .get();
  if (!deleted) throw new HttpError(404, 'not_found', 'Book not found');
}
