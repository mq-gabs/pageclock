import { and, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import {
  checkSession,
  issuesToFields,
  readingSpeed,
  sessionMinutes,
  sessionPages,
  shouldOfferFinish,
  statusAfterSessionSaved,
  suggestStartPage,
  type CheckSessionBody,
  type CreateSessionInput,
  type SaveSessionResponse,
  type Session,
  type SessionCheckResponse,
  type SessionDraft,
  type SessionRecord,
  type UpdateSessionInput,
} from '@reading-tracker/shared';
import type { Db, DbOrTx } from '../db/client';
import { books, readingSessions, type ReadingSessionRow } from '../db/schema';
import { HttpError, WarningsError } from '../middleware/errors';
import { findBookRow, getBookWithProgress } from './books';

export const toRecord = (row: ReadingSessionRow): SessionRecord => ({
  id: row.id,
  bookId: row.bookId,
  startedAt: row.startedAt,
  endedAt: row.endedAt,
  startPage: row.startPage,
  endPage: row.endPage,
  pausedSeconds: row.pausedSeconds,
});

export function toSession(row: ReadingSessionRow): Session {
  const { endedAt, endPage } = row;
  let metrics: Session['metrics'] = null;
  if (endedAt && endPage !== null) {
    const pages = sessionPages({ startPage: row.startPage, endPage });
    const minutes = sessionMinutes({
      startedAt: row.startedAt,
      endedAt,
      pausedSeconds: row.pausedSeconds,
    });
    metrics = { pages, minutes, speed: readingSpeed(pages, minutes) };
  }
  return {
    id: row.id,
    bookId: row.bookId,
    startedAt: row.startedAt.toISOString(),
    endedAt: endedAt?.toISOString() ?? null,
    pausedAt: row.pausedAt?.toISOString() ?? null,
    pausedSeconds: row.pausedSeconds,
    startPage: row.startPage,
    endPage,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    metrics,
  };
}

/** The book's sessions plus any session (of any book, running or not) overlapping the draft's time. */
function relevantSessions(db: DbOrTx, draft: SessionDraft): SessionRecord[] {
  return db
    .select()
    .from(readingSessions)
    .where(
      or(
        eq(readingSessions.bookId, draft.bookId),
        and(
          lt(readingSessions.startedAt, draft.endedAt),
          or(isNull(readingSessions.endedAt), gt(readingSessions.endedAt, draft.startedAt)),
        ),
      ),
    )
    .all()
    .map(toRecord);
}

function runChecks(db: DbOrTx, draft: SessionDraft, now: Date): SessionCheckResponse {
  const book = findBookRow(db, draft.bookId);
  return checkSession(draft, relevantSessions(db, draft), { totalPages: book.totalPages, now });
}

export function checkDraft(db: Db, body: CheckSessionBody, now = new Date()): SessionCheckResponse {
  return runChecks(
    db,
    { ...body, startedAt: new Date(body.startedAt), endedAt: new Date(body.endedAt) },
    now,
  );
}

/**
 * Rules 2–4 and 6 for a create, an edit or a stopped timer, inside one transaction:
 * hard errors → 400, unconfirmed warnings → 409, otherwise write and update the book status.
 */
export function saveSession(
  db: Db,
  draft: SessionDraft,
  options: { confirmWarnings?: boolean; now?: Date; write: (tx: DbOrTx) => ReadingSessionRow },
): SaveSessionResponse {
  const now = options.now ?? new Date();
  return db.transaction((tx) => {
    const { errors, warnings } = runChecks(tx, draft, now);
    if (errors.length > 0) {
      throw new HttpError(
        400,
        'validation_error',
        'The session breaks a rule',
        issuesToFields(errors),
      );
    }
    if (warnings.length > 0 && !options.confirmWarnings) throw new WarningsError(warnings);

    const row = options.write(tx);
    const book = findBookRow(tx, draft.bookId);
    tx.update(books)
      .set({ status: statusAfterSessionSaved(book.status), updatedAt: now })
      .where(eq(books.id, book.id))
      .run();

    const updated = getBookWithProgress(tx, book.id);
    return {
      session: toSession(row),
      book: updated,
      offerFinish: shouldOfferFinish(updated.status, draft.endPage, updated.totalPages),
    };
  });
}

export function createSession(db: Db, input: CreateSessionInput, now = new Date()) {
  const draft: SessionDraft = {
    bookId: input.bookId,
    startedAt: new Date(input.startedAt),
    endedAt: new Date(input.endedAt),
    startPage: input.startPage,
    endPage: input.endPage,
  };
  return saveSession(db, draft, {
    confirmWarnings: input.confirmWarnings,
    now,
    write: (tx) =>
      tx
        .insert(readingSessions)
        .values({ ...draft, source: 'manual' })
        .returning()
        .get(),
  });
}

function findSessionRow(db: DbOrTx, id: string): ReadingSessionRow {
  const row = db.select().from(readingSessions).where(eq(readingSessions.id, id)).get();
  if (!row) throw new HttpError(404, 'not_found', 'Session not found');
  return row;
}

export function updateSession(db: Db, id: string, input: UpdateSessionInput, now = new Date()) {
  const row = findSessionRow(db, id);
  if (row.endedAt === null || row.endPage === null) {
    throw new HttpError(409, 'session_running', 'Stop the timer before editing this session');
  }
  const draft: SessionDraft = {
    id,
    bookId: row.bookId,
    startedAt: input.startedAt ? new Date(input.startedAt) : row.startedAt,
    endedAt: input.endedAt ? new Date(input.endedAt) : row.endedAt,
    startPage: input.startPage ?? row.startPage,
    endPage: input.endPage ?? row.endPage,
    pausedSeconds: row.pausedSeconds,
  };
  return saveSession(db, draft, {
    confirmWarnings: input.confirmWarnings,
    now,
    write: (tx) =>
      tx
        .update(readingSessions)
        .set({
          startedAt: draft.startedAt,
          endedAt: draft.endedAt,
          startPage: draft.startPage,
          endPage: draft.endPage,
          updatedAt: now,
        })
        .where(eq(readingSessions.id, id))
        .returning()
        .get(),
  });
}

export function deleteSession(db: Db, id: string) {
  const deleted = db
    .delete(readingSessions)
    .where(eq(readingSessions.id, id))
    .returning({ id: readingSessions.id })
    .get();
  if (!deleted) throw new HttpError(404, 'not_found', 'Session not found');
}

/** The book's sessions, newest first. */
export function listBookSessions(db: Db, bookId: string): Session[] {
  findBookRow(db, bookId);
  return db
    .select()
    .from(readingSessions)
    .where(eq(readingSessions.bookId, bookId))
    .orderBy(desc(readingSessions.startedAt))
    .all()
    .map(toSession);
}

/** Rule 1 for the book at `at`. */
export function suggestedStartPage(db: Db, bookId: string, at: Date): number {
  const book = findBookRow(db, bookId);
  const sessions = db
    .select()
    .from(readingSessions)
    .where(eq(readingSessions.bookId, bookId))
    .all()
    .map(toRecord);
  return suggestStartPage(sessions, at, book.totalPages);
}
