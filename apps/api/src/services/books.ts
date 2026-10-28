import { and, asc, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import type { Book, ListBooksQuery } from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { books, type BookRow } from '../db/schema';

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

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export function listBooks(db: Db, query: ListBooksQuery): Book[] {
  const conditions: SQL[] = [];
  if (query.status) conditions.push(eq(books.status, query.status));
  if (query.q) {
    const pattern = `%${escapeLike(query.q)}%`;
    const match = or(
      sql`${books.title} like ${pattern} escape '\\'`,
      sql`${books.author} like ${pattern} escape '\\'`,
    );
    if (match) conditions.push(match);
  }
  return db
    .select()
    .from(books)
    .where(and(...conditions))
    .orderBy(desc(books.updatedAt), asc(books.title))
    .all()
    .map(toBook);
}
