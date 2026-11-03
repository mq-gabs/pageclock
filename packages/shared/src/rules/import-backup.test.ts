import { describe, expect, it } from 'vitest';
import { backupSchema, type BackupInput } from '../schemas/backup';
import { session } from '../test-utils';
import { planBackupImport, type LibraryBook } from './import-backup';

const now = new Date('2026-10-28T15:00:00Z');
let ids = 0;
const newId = () => `new-${++ids}`;

const backup = (fields: Partial<BackupInput> = {}) =>
  backupSchema.parse({
    format: 'pageclock-backup',
    version: 1,
    books: [{ id: 'b1', title: 'Dune', author: 'Frank Herbert', totalPages: 400 }],
    sessions: [
      {
        bookId: 'b1',
        startedAt: '2026-10-27T10:00:00Z',
        endedAt: '2026-10-27T11:00:00Z',
        startPage: 1,
        endPage: 30,
      },
    ],
    ...fields,
  });

const empty = { books: [], sessions: [] };
const dune: LibraryBook = { id: 'lib-1', title: 'Dune', author: 'Frank Herbert', totalPages: 400 };

describe('planBackupImport', () => {
  it('does nothing for an empty backup', () => {
    const plan = planBackupImport(backup({ books: [], sessions: [] }), empty, now, newId);
    expect(plan).toEqual({
      issues: {},
      books: [],
      sessions: [],
      matchedBooks: 0,
      skippedSessions: 0,
    });
  });

  it('adds new books with new ids and links their sessions', () => {
    const plan = planBackupImport(backup(), empty, now, newId);
    expect(plan.issues).toEqual({});
    expect(plan.books).toHaveLength(1);
    const [book] = plan.books;
    expect(book).toMatchObject({ title: 'Dune', status: 'want_to_read', finishedAt: null });
    expect(book!.id).toMatch(/^new-/);
    expect(book!.createdAt).toEqual(now);
    expect(plan.sessions).toEqual([
      expect.objectContaining({
        bookId: book!.id,
        startPage: 1,
        endPage: 30,
        pausedSeconds: 0,
        source: 'manual',
        createdAt: new Date('2026-10-27T11:00:00Z'),
      }),
    ]);
  });

  it('keeps timestamps and finishedAt from the file', () => {
    const plan = planBackupImport(
      backup({
        books: [
          {
            id: 'b1',
            title: 'Dune',
            author: 'Frank Herbert',
            totalPages: 400,
            status: 'finished',
            finishedAt: '2026-10-01T09:00:00Z',
            createdAt: '2026-09-01T09:00:00Z',
            updatedAt: '2026-10-01T09:00:00Z',
          },
        ],
      }),
      empty,
      now,
      newId,
    );
    expect(plan.books[0]).toMatchObject({
      finishedAt: new Date('2026-10-01T09:00:00Z'),
      createdAt: new Date('2026-09-01T09:00:00Z'),
      updatedAt: new Date('2026-10-01T09:00:00Z'),
    });
  });

  it('gives a finished book without finishedAt the import time, and clears it otherwise', () => {
    const book = { id: 'b1', title: 'Dune', author: 'Frank Herbert', totalPages: 400 };
    const finished = planBackupImport(
      backup({ books: [{ ...book, status: 'finished' }], sessions: [] }),
      empty,
      now,
      newId,
    );
    expect(finished.books[0]!.finishedAt).toEqual(now);
    const reading = planBackupImport(
      backup({
        books: [{ ...book, status: 'reading', finishedAt: '2026-10-01T09:00:00Z' }],
        sessions: [],
      }),
      empty,
      now,
      newId,
    );
    expect(reading.books[0]!.finishedAt).toBeNull();
  });

  it('matches a library book by title and author, ignoring case and spaces', () => {
    const plan = planBackupImport(
      backup({
        books: [{ id: 'b1', title: '  dune ', author: 'FRANK HERBERT', totalPages: 400 }],
      }),
      { books: [dune], sessions: [] },
      now,
      newId,
    );
    expect(plan.books).toEqual([]);
    expect(plan.matchedBooks).toBe(1);
    expect(plan.sessions[0]!.bookId).toBe('lib-1');
  });

  it('merges two books of the file with the same title and author', () => {
    const plan = planBackupImport(
      backup({
        books: [
          { id: 'b1', title: 'Dune', author: 'Frank Herbert', totalPages: 400 },
          { id: 'b2', title: 'DUNE', author: 'Frank Herbert', totalPages: 400 },
        ],
        sessions: [
          {
            bookId: 'b2',
            startedAt: '2026-10-27T10:00:00Z',
            endedAt: '2026-10-27T11:00:00Z',
            startPage: 1,
            endPage: 30,
          },
        ],
      }),
      empty,
      now,
      newId,
    );
    expect(plan.books).toHaveLength(1);
    expect(plan.matchedBooks).toBe(1);
    expect(plan.sessions[0]!.bookId).toBe(plan.books[0]!.id);
  });

  it('skips sessions already in the library and repeated in the file', () => {
    const existing = session({
      bookId: 'lib-1',
      start: '2026-10-27T10:00:00Z',
      end: '2026-10-27T11:00:00Z',
      startPage: 1,
      endPage: 30,
    });
    const s = {
      bookId: 'b1',
      startedAt: '2026-10-27T10:00:00Z',
      endedAt: '2026-10-27T11:00:00Z',
      startPage: 1,
      endPage: 30,
    };
    const later = { ...s, startedAt: '2026-10-27T12:00:00Z', endedAt: '2026-10-27T13:00:00Z' };
    const plan = planBackupImport(
      backup({ sessions: [s, later, later] }),
      { books: [dune], sessions: [existing] },
      now,
      newId,
    );
    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0]!.startedAt).toEqual(new Date('2026-10-27T12:00:00Z'));
    expect(plan.skippedSessions).toBe(2);
  });

  it('keeps sessions with gaps or overlaps (page warnings are not checked)', () => {
    const base = { bookId: 'b1', startPage: 1, endPage: 30 };
    const plan = planBackupImport(
      backup({
        sessions: [
          { ...base, startedAt: '2026-10-27T10:00:00Z', endedAt: '2026-10-27T11:00:00Z' },
          // Overlaps the first in time and pages, then a gap.
          { ...base, startedAt: '2026-10-27T10:30:00Z', endedAt: '2026-10-27T11:30:00Z' },
          {
            ...base,
            startPage: 100,
            endPage: 120,
            startedAt: '2026-10-27T12:00:00Z',
            endedAt: '2026-10-27T13:00:00Z',
          },
        ],
      }),
      empty,
      now,
      newId,
    );
    expect(plan.issues).toEqual({});
    expect(plan.sessions).toHaveLength(3);
  });

  it('accepts a session across midnight in America/Fortaleza', () => {
    // 23:30 → 00:30 Fortaleza time (UTC−3).
    const plan = planBackupImport(
      backup({
        sessions: [
          {
            bookId: 'b1',
            startedAt: '2026-10-26T23:30:00-03:00',
            endedAt: '2026-10-27T00:30:00-03:00',
            startPage: 1,
            endPage: 20,
          },
        ],
      }),
      empty,
      now,
      newId,
    );
    expect(plan.issues).toEqual({});
    expect(plan.sessions[0]).toMatchObject({
      startedAt: new Date('2026-10-27T02:30:00Z'),
      endedAt: new Date('2026-10-27T03:30:00Z'),
    });
  });

  it('reports rule 2 problems by path in the file', () => {
    const s = {
      bookId: 'b1',
      startedAt: '2026-10-27T10:00:00Z',
      endedAt: '2026-10-27T11:00:00Z',
      startPage: 1,
      endPage: 30,
    };
    const plan = planBackupImport(
      backup({
        sessions: [
          s,
          { ...s, endPage: 401 },
          { ...s, startPage: 0 },
          { ...s, endedAt: '2026-10-29T11:00:00Z', startedAt: '2026-10-29T10:00:00Z' },
          { ...s, endedAt: s.startedAt },
        ],
      }),
      empty,
      now,
      newId,
    );
    expect(plan.issues).toEqual({
      'sessions.1.endPage': [expect.stringContaining('400 pages')],
      'sessions.2.startPage': ['Start page must be at least 1.'],
      'sessions.3.endedAt': ['End time can’t be in the future.'],
      'sessions.4.endedAt': ['End time must be after the start time.'],
    });
  });

  it('checks end pages against the library book a file book matched', () => {
    const plan = planBackupImport(
      backup({
        books: [{ id: 'b1', title: 'Dune', author: 'Frank Herbert', totalPages: 900 }],
        sessions: [
          {
            bookId: 'b1',
            startedAt: '2026-10-27T10:00:00Z',
            endedAt: '2026-10-27T11:00:00Z',
            startPage: 400,
            endPage: 500,
          },
        ],
      }),
      { books: [dune], sessions: [] },
      now,
      newId,
    );
    expect(Object.keys(plan.issues)).toEqual(['sessions.0.endPage']);
  });

  it('rejects paused time as long as the session', () => {
    const s = {
      bookId: 'b1',
      startedAt: '2026-10-27T10:00:00Z',
      endedAt: '2026-10-27T11:00:00Z',
      startPage: 1,
      endPage: 30,
    };
    const plan = planBackupImport(
      backup({
        sessions: [
          { ...s, pausedSeconds: 3599 },
          { ...s, pausedSeconds: 3600 },
        ],
      }),
      empty,
      now,
      newId,
    );
    expect(plan.issues).toEqual({
      'sessions.1.pausedSeconds': ['Paused time must be shorter than the session.'],
    });
  });
});

describe('backupSchema', () => {
  const issuePaths = (input: unknown) => {
    const result = backupSchema.safeParse(input);
    return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
  };

  it('requires the format and version', () => {
    expect(issuePaths({ books: [], sessions: [] })).toEqual(['format', 'version']);
    expect(issuePaths({ format: 'pageclock-backup', version: 2, books: [], sessions: [] })).toEqual(
      ['version'],
    );
  });

  it('validates books like the Add book form', () => {
    expect(
      issuePaths({
        format: 'pageclock-backup',
        version: 1,
        books: [{ id: 'b1', title: ' ', author: 'A', totalPages: 0 }],
        sessions: [],
      }),
    ).toEqual(['books.0.title', 'books.0.totalPages']);
  });

  it('rejects duplicate book ids and sessions of unknown books', () => {
    const book = { id: 'b1', title: 'T', author: 'A', totalPages: 10 };
    expect(
      issuePaths({
        format: 'pageclock-backup',
        version: 1,
        books: [book, book],
        sessions: [
          {
            bookId: 'nope',
            startedAt: '2026-10-27T10:00:00Z',
            endedAt: '2026-10-27T11:00:00Z',
            startPage: 1,
            endPage: 2,
          },
        ],
      }),
    ).toEqual(['books.1.id', 'sessions.0.bookId']);
  });
});
