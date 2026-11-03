import type { Backup } from '../schemas/backup';
import type { BookStatus } from '../schemas/books';
import type { SessionSource } from '../schemas/sessions';
import { validateSession } from './validate-session';

/** A book already in the user's library. */
export interface LibraryBook {
  id: string;
  title: string;
  author: string;
  totalPages: number;
}

/** A session already in the user's library (only finished ones can match a backup's). */
export interface LibrarySession {
  bookId: string;
  startedAt: Date;
  endedAt: Date | null;
  startPage: number;
  endPage: number | null;
}

export interface PlannedBook {
  id: string;
  title: string;
  author: string;
  totalPages: number;
  status: BookStatus;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlannedSession {
  bookId: string;
  startedAt: Date;
  endedAt: Date;
  pausedSeconds: number;
  startPage: number;
  endPage: number;
  source: SessionSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportPlan {
  /** Problems by path in the file (`sessions.3.endPage`); nothing is imported when any exist. */
  issues: Record<string, string[]>;
  books: PlannedBook[];
  sessions: PlannedSession[];
  /** Backup books that were already in the library (by title and author). */
  matchedBooks: number;
  /** Backup sessions that were already in the library, or repeated in the file. */
  skippedSessions: number;
}

/** Books match when title and author agree, ignoring case and surrounding spaces. */
const bookKey = (book: { title: string; author: string }) =>
  `${book.title.trim().toLowerCase()}\u0000${book.author.trim().toLowerCase()}`;

const sessionKey = (s: {
  bookId: string;
  startedAt: Date;
  endedAt: Date | null;
  startPage: number;
  endPage: number | null;
}) => [s.bookId, s.startedAt.getTime(), s.endedAt?.getTime(), s.startPage, s.endPage].join('|');

/**
 * Merges a backup into a library without touching what is there: books are added unless one
 * with the same title and author exists (then its sessions go to that book), and sessions are
 * added unless the same one (book, times and pages) exists. Importing a file twice adds nothing.
 * Sessions must pass rule 2 against the book they land on; page and time warnings (rule 3)
 * are not checked, since the backup's sessions were confirmed when they were logged.
 */
export function planBackupImport(
  backup: Backup,
  library: { books: readonly LibraryBook[]; sessions: readonly LibrarySession[] },
  now: Date,
  newId: () => string = () => crypto.randomUUID(),
): ImportPlan {
  const issues: Record<string, string[]> = {};
  const addIssue = (path: string, message: string) => (issues[path] ??= []).push(message);

  const targets = new Map<string, { id: string; totalPages: number }>();
  for (const book of library.books) {
    targets.set(bookKey(book), { id: book.id, totalPages: book.totalPages });
  }

  const books: PlannedBook[] = [];
  let matchedBooks = 0;
  /** Backup book id → the library book its sessions go to. */
  const targetOf = new Map<string, { id: string; totalPages: number }>();

  for (const book of backup.books) {
    const key = bookKey(book);
    const existing = targets.get(key);
    if (existing) {
      matchedBooks++;
      targetOf.set(book.id, existing);
      continue;
    }
    const createdAt = book.createdAt ? new Date(book.createdAt) : now;
    const finishedAt =
      book.status === 'finished' ? (book.finishedAt ? new Date(book.finishedAt) : now) : null;
    const planned: PlannedBook = {
      id: newId(),
      title: book.title,
      author: book.author,
      totalPages: book.totalPages,
      status: book.status,
      finishedAt,
      createdAt,
      updatedAt: book.updatedAt ? new Date(book.updatedAt) : createdAt,
    };
    books.push(planned);
    const target = { id: planned.id, totalPages: planned.totalPages };
    targets.set(key, target);
    targetOf.set(book.id, target);
  }

  const seen = new Set(library.sessions.map(sessionKey));
  const sessions: PlannedSession[] = [];
  let skippedSessions = 0;

  backup.sessions.forEach((session, index) => {
    const target = targetOf.get(session.bookId);
    if (!target) {
      addIssue(`sessions.${index}.bookId`, 'No book in the file has this id');
      return;
    }
    const startedAt = new Date(session.startedAt);
    const endedAt = new Date(session.endedAt);
    const draft = {
      bookId: target.id,
      startedAt,
      endedAt,
      startPage: session.startPage,
      endPage: session.endPage,
    };

    const problems = validateSession(draft, { totalPages: target.totalPages, now });
    for (const problem of problems) addIssue(`sessions.${index}.${problem.field}`, problem.message);
    const durationSeconds = (endedAt.getTime() - startedAt.getTime()) / 1000;
    if (durationSeconds > 0 && session.pausedSeconds >= durationSeconds) {
      addIssue(`sessions.${index}.pausedSeconds`, 'Paused time must be shorter than the session.');
    }
    if (problems.length > 0) return;

    const key = sessionKey(draft);
    if (seen.has(key)) {
      skippedSessions++;
      return;
    }
    seen.add(key);
    const createdAt = session.createdAt ? new Date(session.createdAt) : endedAt;
    sessions.push({
      ...draft,
      pausedSeconds: session.pausedSeconds,
      source: session.source,
      createdAt,
      updatedAt: session.updatedAt ? new Date(session.updatedAt) : createdAt,
    });
  });

  return { issues, books, sessions, matchedBooks, skippedSessions };
}
