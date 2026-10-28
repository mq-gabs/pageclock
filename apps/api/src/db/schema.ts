import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { bookLimits, bookStatuses, sessionSources } from '@reading-tracker/shared';

const nowMs = sql`(cast(unixepoch('subsec') * 1000 as integer))`;

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(nowMs)
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(nowMs)
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
};

const id = text('id')
  .primaryKey()
  .$defaultFn(() => crypto.randomUUID());

export const books = sqliteTable(
  'books',
  {
    id,
    title: text('title').notNull(),
    author: text('author').notNull(),
    totalPages: integer('total_pages').notNull(),
    status: text('status', { enum: bookStatuses }).notNull().default('want_to_read'),
    finishedAt: integer('finished_at', { mode: 'timestamp_ms' }),
    ...timestamps,
  },
  (t) => [
    check(
      'books_title_length',
      sql`length(${t.title}) between 1 and ${sql.raw(String(bookLimits.titleMax))}`,
    ),
    check(
      'books_author_length',
      sql`length(${t.author}) between 1 and ${sql.raw(String(bookLimits.authorMax))}`,
    ),
    check(
      'books_total_pages_range',
      sql`${t.totalPages} between ${sql.raw(String(bookLimits.totalPagesMin))} and ${sql.raw(String(bookLimits.totalPagesMax))}`,
    ),
    check('books_status_enum', sql`${t.status} in ('want_to_read', 'reading', 'finished')`),
  ],
);

export const readingSessions = sqliteTable(
  'reading_sessions',
  {
    id,
    bookId: text('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    startedAt: integer('started_at', { mode: 'timestamp_ms' }).notNull(),
    endedAt: integer('ended_at', { mode: 'timestamp_ms' }),
    pausedAt: integer('paused_at', { mode: 'timestamp_ms' }),
    pausedSeconds: integer('paused_seconds').notNull().default(0),
    startPage: integer('start_page').notNull(),
    endPage: integer('end_page'),
    source: text('source', { enum: sessionSources }).notNull(),
    ...timestamps,
  },
  (t) => [
    index('reading_sessions_started_at_idx').on(t.startedAt),
    index('reading_sessions_book_id_started_at_idx').on(t.bookId, t.startedAt),
    check('reading_sessions_start_page_min', sql`${t.startPage} >= 0`),
    check('reading_sessions_paused_seconds_min', sql`${t.pausedSeconds} >= 0`),
    check('reading_sessions_source_enum', sql`${t.source} in ('timer', 'manual')`),
  ],
);

export type BookRow = typeof books.$inferSelect;
export type NewBookRow = typeof books.$inferInsert;
export type ReadingSessionRow = typeof readingSessions.$inferSelect;
export type NewReadingSessionRow = typeof readingSessions.$inferInsert;
