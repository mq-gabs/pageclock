import { z } from 'zod';
import { bookStatusSchema, createBookSchema } from './books';
import { sessionSourceSchema } from './sessions';

export const BACKUP_FORMAT = 'pageclock-backup';
export const BACKUP_VERSION = 1;

export const backupLimits = { booksMax: 10_000, sessionsMax: 100_000 } as const;

const isoDate = z.iso.datetime({ offset: true, error: 'Expected an ISO date-time' });
const page = z.int('Use a whole page number');

/** A book in a backup file. `id` only links the book to its sessions inside the file. */
export const backupBookSchema = createBookSchema.extend({
  id: z.string().trim().min(1, 'Give the book an id').max(100),
  status: bookStatusSchema.default('want_to_read'),
  finishedAt: isoDate.nullable().default(null),
  createdAt: isoDate.optional(),
  updatedAt: isoDate.optional(),
});
export type BackupBook = z.infer<typeof backupBookSchema>;

/** A finished session in a backup file; running timers are not backed up. */
export const backupSessionSchema = z.object({
  bookId: z.string().trim().min(1, 'Give the session a bookId').max(100),
  startedAt: isoDate,
  endedAt: isoDate,
  pausedSeconds: z.int('Use whole seconds').min(0, 'Paused time can’t be negative').default(0),
  startPage: page,
  endPage: page,
  source: sessionSourceSchema.default('manual'),
  createdAt: isoDate.optional(),
  updatedAt: isoDate.optional(),
});
export type BackupSession = z.infer<typeof backupSessionSchema>;

/** Body of `POST /api/backup` and answer of `GET /api/backup`. */
export const backupSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT, 'This isn’t a Pageclock backup file'),
    version: z.literal(BACKUP_VERSION, 'This backup version isn’t supported'),
    exportedAt: isoDate.optional(),
    books: z
      .array(backupBookSchema)
      .max(backupLimits.booksMax, `At most ${backupLimits.booksMax} books`),
    sessions: z
      .array(backupSessionSchema)
      .max(backupLimits.sessionsMax, `At most ${backupLimits.sessionsMax} sessions`),
  })
  .superRefine((backup, ctx) => {
    const ids = new Set<string>();
    backup.books.forEach((book, index) => {
      if (ids.has(book.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['books', index, 'id'],
          message: 'Duplicate book id',
        });
      }
      ids.add(book.id);
    });
    backup.sessions.forEach((session, index) => {
      if (!ids.has(session.bookId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sessions', index, 'bookId'],
          message: 'No book in the file has this id',
        });
      }
    });
  });
export type Backup = z.infer<typeof backupSchema>;
export type BackupInput = z.input<typeof backupSchema>;

export const importBackupResponseSchema = z.object({
  books: z.object({ added: z.int(), matched: z.int() }),
  sessions: z.object({ added: z.int(), skipped: z.int() }),
});
export type ImportBackupResponse = z.infer<typeof importBackupResponseSchema>;
