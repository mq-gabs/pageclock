import { pathToFileURL } from 'node:url';
import { TZDate } from '@date-fns/tz';
import { addMinutes, set, subDays } from 'date-fns';
import { createInsertSchema } from 'drizzle-zod';
import { bookLimits, type BookStatus } from '@reading-tracker/shared';
import { config } from '../config';
import { logger } from '../logger';
import { createDb, type Db } from './client';
import { books, readingSessions, type NewBookRow, type NewReadingSessionRow } from './schema';

/** One logged session: local start ("N days ago at HH:mm" in APP_TIMEZONE), length and pages read. */
type DemoSession = [daysAgo: number, localTime: string, minutes: number, pages: number];

interface DemoBook {
  title: string;
  author: string;
  totalPages: number;
  status: BookStatus;
  sessions: DemoSession[];
}

// Pages chain from one session to the next (each starts on the page after the previous end), sessions
// never overlap in time, and none start today, so every row passes the hard rules.
const demoBooks: DemoBook[] = [
  {
    title: 'The Left Hand of Darkness',
    author: 'Ursula K. Le Guin',
    totalPages: 304,
    status: 'finished',
    sessions: [
      [40, '20:30', 50, 38],
      [39, '21:00', 60, 45],
      [37, '19:45', 75, 52],
      [36, '22:10', 45, 30],
      [34, '20:00', 90, 66],
      [33, '23:40', 40, 28], // crosses local midnight; counts on its start date
      [31, '18:30', 70, 45],
    ],
  },
  {
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    totalPages: 476,
    status: 'reading',
    sessions: [
      [12, '20:15', 45, 32],
      [11, '07:10', 30, 20],
      [9, '21:30', 60, 46],
      [6, '19:00', 40, 26],
      [4, '22:00', 35, 24],
      [3, '20:45', 25, 14],
      [1, '21:15', 20, 12], // ends on page 174
    ],
  },
  {
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    totalPages: 499,
    status: 'reading',
    sessions: [
      [26, '08:00', 40, 18],
      [24, '12:30', 30, 14],
      [19, '08:15', 50, 25],
      [2, '07:30', 45, 22],
    ],
  },
  {
    title: 'Piranesi',
    author: 'Susanna Clarke',
    totalPages: 272,
    status: 'want_to_read',
    sessions: [],
  },
  {
    title: 'The Dispossessed',
    author: 'Ursula K. Le Guin',
    totalPages: 387,
    status: 'want_to_read',
    sessions: [],
  },
];

const insertBookSchema = createInsertSchema(books, {
  title: (s) => s.min(1).max(bookLimits.titleMax),
  author: (s) => s.min(1).max(bookLimits.authorMax),
  totalPages: (s) => s.min(bookLimits.totalPagesMin).max(bookLimits.totalPagesMax),
});
const insertSessionSchema = createInsertSchema(readingSessions, {
  startPage: (s) => s.min(1),
});

function localStart(now: Date, daysAgo: number, localTime: string, timeZone: string): Date {
  const [hours = 0, minutes = 0] = localTime.split(':').map(Number);
  const day = subDays(new TZDate(now, timeZone), daysAgo);
  return new Date(set(day, { hours, minutes, seconds: 0, milliseconds: 0 }).getTime());
}

/** Replaces all data with the demo library. Dates are relative to `now`. */
export function seed(db: Db, now = new Date(), timeZone = config.appTimezone) {
  const bookRows: NewBookRow[] = [];
  const sessionRows: NewReadingSessionRow[] = [];

  for (const demo of demoBooks) {
    const bookId = crypto.randomUUID();
    let page = 0;
    let lastEnd: Date | null = null;

    for (const [daysAgo, localTime, minutes, pages] of demo.sessions) {
      const startedAt = localStart(now, daysAgo, localTime, timeZone);
      const endedAt = addMinutes(startedAt, minutes);
      sessionRows.push(
        insertSessionSchema.parse({
          bookId,
          startedAt,
          endedAt,
          startPage: page + 1,
          endPage: page + pages,
          source: daysAgo % 2 === 0 ? 'manual' : 'timer',
          createdAt: endedAt,
          updatedAt: endedAt,
        }),
      );
      page += pages;
      lastEnd = endedAt;
    }

    if (page > demo.totalPages) throw new Error(`Seed: "${demo.title}" reads past its last page`);
    if (demo.status === 'finished' && page !== demo.totalPages) {
      throw new Error(`Seed: "${demo.title}" is finished but stops on page ${page}`);
    }

    const firstStart = demo.sessions[0]
      ? localStart(now, demo.sessions[0][0], demo.sessions[0][1], timeZone)
      : subDays(now, 20);
    bookRows.push(
      insertBookSchema.parse({
        id: bookId,
        title: demo.title,
        author: demo.author,
        totalPages: demo.totalPages,
        status: demo.status,
        finishedAt: demo.status === 'finished' ? lastEnd : null,
        createdAt: subDays(firstStart, 1),
        updatedAt: lastEnd ?? subDays(firstStart, 1),
      }),
    );
  }

  db.transaction((tx) => {
    tx.delete(readingSessions).run();
    tx.delete(books).run();
    tx.insert(books).values(bookRows).run();
    tx.insert(readingSessions).values(sessionRows).run();
  });

  return { books: bookRows.length, sessions: sessionRows.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const db = createDb();
  const counts = seed(db);
  logger.info(counts, `Seeded ${config.databaseUrl}`);
  db.$client.close();
}
