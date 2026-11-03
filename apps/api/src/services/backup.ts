import { and, asc, eq, isNotNull } from 'drizzle-orm';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  isCompleted,
  planBackupImport,
  type Backup,
  type ImportBackupResponse,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { books, readingSessions } from '../db/schema';
import { HttpError } from '../middleware/errors';

/** The user's books and finished sessions; a running timer is left out. */
export function exportBackup(db: Db, userId: string, now = new Date()): Backup {
  const bookRows = db
    .select()
    .from(books)
    .where(eq(books.userId, userId))
    .orderBy(asc(books.createdAt), asc(books.title))
    .all();
  const sessionRows = db
    .select()
    .from(readingSessions)
    .where(
      and(
        eq(readingSessions.userId, userId),
        isNotNull(readingSessions.endedAt),
        isNotNull(readingSessions.endPage),
      ),
    )
    .orderBy(asc(readingSessions.startedAt))
    .all();

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    books: bookRows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      totalPages: row.totalPages,
      status: row.status,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
    sessions: sessionRows.filter(isCompleted).map((row) => ({
      bookId: row.bookId,
      startedAt: row.startedAt.toISOString(),
      endedAt: row.endedAt.toISOString(),
      pausedSeconds: row.pausedSeconds,
      startPage: row.startPage,
      endPage: row.endPage,
      source: row.source,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

/** Merges a backup into the user's library in one transaction (see `planBackupImport`). */
export function importBackup(
  db: Db,
  userId: string,
  backup: Backup,
  now = new Date(),
): ImportBackupResponse {
  return db.transaction((tx) => {
    const library = {
      books: tx.select().from(books).where(eq(books.userId, userId)).all(),
      sessions: tx.select().from(readingSessions).where(eq(readingSessions.userId, userId)).all(),
    };
    const plan = planBackupImport(backup, library, now);
    if (Object.keys(plan.issues).length > 0) {
      throw new HttpError(400, 'validation_error', 'The backup has invalid data', plan.issues);
    }

    // SQLite caps bound parameters per statement, so insert in chunks.
    for (const chunk of chunks(plan.books, 500)) {
      tx.insert(books)
        .values(chunk.map((book) => ({ ...book, userId })))
        .run();
    }
    for (const chunk of chunks(plan.sessions, 500)) {
      tx.insert(readingSessions)
        .values(chunk.map((session) => ({ ...session, userId })))
        .run();
    }

    return {
      books: { added: plan.books.length, matched: plan.matchedBooks },
      sessions: { added: plan.sessions.length, skipped: plan.skippedSessions },
    };
  });
}

function* chunks<T>(items: readonly T[], size: number) {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}
