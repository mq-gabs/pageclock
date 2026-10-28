import { and, eq, isNull } from 'drizzle-orm';
import {
  issuesToFields,
  latestSessionBefore,
  pausedSecondsAfterResume,
  suggestStartPage,
  timerEndedAt,
  validateTimerStartPage,
  type SaveSessionResponse,
  type SessionDraft,
  type StartTimerInput,
  type StopTimerInput,
  type Timer,
  type UpdateTimerInput,
} from '@reading-tracker/shared';
import type { Db, DbOrTx } from '../db/client';
import { readingSessions, type ReadingSessionRow } from '../db/schema';
import { HttpError } from '../middleware/errors';
import { findBookRow, getBookWithProgress } from './books';
import { saveSession, toRecord, toSession } from './sessions';

const findRunningRow = (db: DbOrTx): ReadingSessionRow | undefined =>
  db.select().from(readingSessions).where(isNull(readingSessions.endedAt)).get();

function requireRunning(db: DbOrTx): ReadingSessionRow {
  const row = findRunningRow(db);
  if (!row) throw new HttpError(404, 'no_timer', 'No timer is running');
  return row;
}

const bookSessions = (db: DbOrTx, bookId: string) =>
  db.select().from(readingSessions).where(eq(readingSessions.bookId, bookId)).all().map(toRecord);

function assertStartPage(startPage: number, totalPages: number) {
  const issues = validateTimerStartPage(startPage, totalPages);
  if (issues.length > 0) {
    throw new HttpError(400, 'validation_error', 'Invalid start page', issuesToFields(issues));
  }
}

function toTimer(db: DbOrTx, row: ReadingSessionRow): Timer {
  const previous = latestSessionBefore(bookSessions(db, row.bookId), row.startedAt, {
    excludeId: row.id,
  });
  return {
    session: toSession(row),
    book: getBookWithProgress(db, row.bookId),
    previous: previous
      ? { endPage: previous.endPage, startedAt: previous.startedAt.toISOString() }
      : null,
  };
}

/** The running timer with its book, or null. */
export function getTimer(db: Db): Timer | null {
  const row = findRunningRow(db);
  return row ? toTimer(db, row) : null;
}

/** Rule 5: start a timer unless one is running; rule 1 fills in the start page if missing. */
export function startTimer(db: Db, input: StartTimerInput, now = new Date()): Timer {
  return db.transaction((tx) => {
    if (findRunningRow(tx)) {
      throw new HttpError(409, 'timer_running', 'A timer is already running');
    }
    const book = findBookRow(tx, input.bookId);
    const startPage = input.startPage ?? suggestStartPage(bookSessions(tx, book.id), now, book.totalPages);
    assertStartPage(startPage, book.totalPages);
    const row = tx
      .insert(readingSessions)
      .values({ bookId: book.id, startedAt: now, startPage, source: 'timer' })
      .returning()
      .get();
    return toTimer(tx, row);
  });
}

export function updateTimer(db: Db, input: UpdateTimerInput, now = new Date()): Timer {
  return db.transaction((tx) => {
    const row = requireRunning(tx);
    assertStartPage(input.startPage, findBookRow(tx, row.bookId).totalPages);
    const updated = tx
      .update(readingSessions)
      .set({ startPage: input.startPage, updatedAt: now })
      .where(eq(readingSessions.id, row.id))
      .returning()
      .get();
    return toTimer(tx, updated);
  });
}

export function pauseTimer(db: Db, now = new Date()): Timer {
  return db.transaction((tx) => {
    const row = requireRunning(tx);
    if (row.pausedAt) throw new HttpError(409, 'timer_paused', 'The timer is already paused');
    const updated = tx
      .update(readingSessions)
      .set({ pausedAt: now, updatedAt: now })
      .where(eq(readingSessions.id, row.id))
      .returning()
      .get();
    return toTimer(tx, updated);
  });
}

export function resumeTimer(db: Db, now = new Date()): Timer {
  return db.transaction((tx) => {
    const row = requireRunning(tx);
    if (!row.pausedAt) throw new HttpError(409, 'timer_not_paused', 'The timer isn’t paused');
    const updated = tx
      .update(readingSessions)
      .set({ pausedAt: null, pausedSeconds: pausedSecondsAfterResume(row, now), updatedAt: now })
      .where(eq(readingSessions.id, row.id))
      .returning()
      .get();
    return toTimer(tx, updated);
  });
}

/**
 * Rule 5: stop with an end page, through the same rules 2–4 and 6 as a manual log. A paused
 * timer ends when it was paused, so the time spent on the Finish screen doesn't count.
 */
export function stopTimer(db: Db, input: StopTimerInput, now = new Date()): SaveSessionResponse {
  const row = requireRunning(db);
  const endedAt = timerEndedAt(row, now);
  const draft: SessionDraft = {
    id: row.id,
    bookId: row.bookId,
    startedAt: row.startedAt,
    endedAt,
    startPage: row.startPage,
    endPage: input.endPage,
    pausedSeconds: row.pausedSeconds,
  };
  return saveSession(db, draft, {
    confirmWarnings: input.confirmWarnings,
    now,
    write: (tx) => {
      const saved = tx
        .update(readingSessions)
        .set({ endedAt, endPage: input.endPage, pausedAt: null, updatedAt: now })
        .where(and(eq(readingSessions.id, row.id), isNull(readingSessions.endedAt)))
        .returning()
        .get();
      if (!saved) throw new HttpError(404, 'no_timer', 'No timer is running');
      return saved;
    },
  });
}
