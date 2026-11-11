import { and, eq, isNull } from 'drizzle-orm';
import {
  acceptTimerAction,
  acceptTimerStart,
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
  type TimerActionInput,
  type AcceptedTime,
  type UpdateTimerInput,
} from '@reading-tracker/shared';
import type { Db, DbOrTx } from '../db/client';
import { readingSessions, type ReadingSessionRow } from '../db/schema';
import { HttpError } from '../middleware/errors';
import { findBookRow, getBookWithProgress } from './books';
import { saveSession, toRecord, toSession } from './sessions';

/** The user's running session; each user has at most one. */
const findRunningRow = (db: DbOrTx, userId: string): ReadingSessionRow | undefined =>
  db
    .select()
    .from(readingSessions)
    .where(and(eq(readingSessions.userId, userId), isNull(readingSessions.endedAt)))
    .get();

/**
 * The running session named by a queued action (rule 5). Another session, or none, is 404:
 * the timer was stopped or discarded, possibly on another device.
 */
function requireRunning(db: DbOrTx, userId: string, sessionId: string): ReadingSessionRow {
  const row = findRunningRow(db, userId);
  if (!row || row.id !== sessionId) throw new HttpError(404, 'no_timer', 'No timer is running');
  return row;
}

/** The queue sends one action at a time, so only the last applied one can come back as a retry. */
const isRetry = (row: ReadingSessionRow, opId: string) => row.lastOpId === opId;

/** Rule 5a: a click time the API can't store is a 400 on `field`. */
function acceptedOrThrow({ at, issue }: AcceptedTime, field: string): Date {
  if (issue) throw new HttpError(400, issue.code, issue.message, { [field]: [issue.message] });
  return at;
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
  // The row belongs to row.userId, so its book does too.
  const previous = latestSessionBefore(bookSessions(db, row.bookId), row.startedAt, {
    excludeId: row.id,
  });
  return {
    session: toSession(row),
    book: getBookWithProgress(db, row.userId, row.bookId),
    previous: previous
      ? { endPage: previous.endPage, startedAt: previous.startedAt.toISOString() }
      : null,
  };
}

/** The running timer with its book, or null. */
export function getTimer(db: Db, userId: string): Timer | null {
  const row = findRunningRow(db, userId);
  return row ? toTimer(db, row) : null;
}

/**
 * Rule 5: start a timer unless one is running, with the browser's `sessionId` as its id and the
 * click time as its start (rule 5a); rule 1 fills in the start page at that time if missing.
 * A retried Start of the running session returns it (`created: false`).
 */
export function startTimer(
  db: Db,
  userId: string,
  input: StartTimerInput,
  now = new Date(),
): { timer: Timer; created: boolean } {
  return db.transaction((tx) => {
    const running = findRunningRow(tx, userId);
    if (running?.id === input.sessionId) return { timer: toTimer(tx, running), created: false };
    if (running) throw new HttpError(409, 'timer_running', 'A timer is already running');
    const existing = tx
      .select({ id: readingSessions.id })
      .from(readingSessions)
      .where(eq(readingSessions.id, input.sessionId))
      .get();
    if (existing) throw new HttpError(409, 'session_exists', 'This session has already ended');

    const book = findBookRow(tx, userId, input.bookId);
    const startedAt = acceptedOrThrow(
      acceptTimerStart(new Date(input.startedAt), now),
      'startedAt',
    );
    const startPage =
      input.startPage ?? suggestStartPage(bookSessions(tx, book.id), startedAt, book.totalPages);
    assertStartPage(startPage, book.totalPages);
    const row = tx
      .insert(readingSessions)
      .values({
        id: input.sessionId,
        userId,
        bookId: book.id,
        startedAt,
        startPage,
        source: 'timer',
        lastOpId: input.opId,
      })
      .returning()
      .get();
    return { timer: toTimer(tx, row), created: true };
  });
}

export function updateTimer(
  db: Db,
  userId: string,
  input: UpdateTimerInput,
  now = new Date(),
): Timer {
  return db.transaction((tx) => {
    const row = requireRunning(tx, userId, input.sessionId);
    if (isRetry(row, input.opId)) return toTimer(tx, row);
    assertStartPage(input.startPage, findBookRow(tx, userId, row.bookId).totalPages);
    const updated = tx
      .update(readingSessions)
      .set({ startPage: input.startPage, lastOpId: input.opId, updatedAt: now })
      .where(eq(readingSessions.id, row.id))
      .returning()
      .get();
    return toTimer(tx, updated);
  });
}

/** Rule 5: pause at the click time (rule 5a). */
export function pauseTimer(
  db: Db,
  userId: string,
  input: TimerActionInput,
  now = new Date(),
): Timer {
  return db.transaction((tx) => {
    const row = requireRunning(tx, userId, input.sessionId);
    if (isRetry(row, input.opId)) return toTimer(tx, row);
    if (row.pausedAt) throw new HttpError(409, 'timer_paused', 'The timer is already paused');
    const pausedAt = acceptedOrThrow(
      acceptTimerAction(row, 'pause', new Date(input.at), now),
      'at',
    );
    const updated = tx
      .update(readingSessions)
      .set({ pausedAt, lastOpId: input.opId, updatedAt: now })
      .where(eq(readingSessions.id, row.id))
      .returning()
      .get();
    return toTimer(tx, updated);
  });
}

/** Rule 5: resume at the click time (rule 5a), adding the pause to `pausedSeconds`. */
export function resumeTimer(
  db: Db,
  userId: string,
  input: TimerActionInput,
  now = new Date(),
): Timer {
  return db.transaction((tx) => {
    const row = requireRunning(tx, userId, input.sessionId);
    if (isRetry(row, input.opId)) return toTimer(tx, row);
    if (!row.pausedAt) throw new HttpError(409, 'timer_not_paused', 'The timer isn’t paused');
    const resumedAt = acceptedOrThrow(
      acceptTimerAction(row, 'resume', new Date(input.at), now),
      'at',
    );
    const updated = tx
      .update(readingSessions)
      .set({
        pausedAt: null,
        pausedSeconds: pausedSecondsAfterResume(row, resumedAt),
        lastOpId: input.opId,
        updatedAt: now,
      })
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
export function stopTimer(
  db: Db,
  userId: string,
  input: StopTimerInput,
  now = new Date(),
): SaveSessionResponse {
  const row = findRunningRow(db, userId);
  if (!row) throw new HttpError(404, 'no_timer', 'No timer is running');
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
  return saveSession(db, userId, draft, {
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
