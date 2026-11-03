import type { ImportBackupResponse } from '@reading-tracker/shared';
import { ApiRequestError } from './api';
import { formatCount } from './format';

/** `pageclock-backup-2026-11-02.json` (UTC date, like the rest of the app). */
export const backupFileName = (now: Date) =>
  `pageclock-backup-${now.toISOString().slice(0, 10)}.json`;

const fieldLabels: Record<string, string> = {
  id: 'id',
  title: 'title',
  author: 'author',
  totalPages: 'total pages',
  status: 'status',
  finishedAt: 'finished date',
  createdAt: 'created date',
  updatedAt: 'updated date',
  bookId: 'book',
  startedAt: 'start time',
  endedAt: 'end time',
  pausedSeconds: 'paused time',
  startPage: 'start page',
  endPage: 'end page',
  source: 'source',
};

/** `sessions.3.endPage` → `Session 4, end page`. */
export function backupPathLabel(path: string): string {
  const [list, index, field] = path.split('.');
  const position = Number(index);
  if ((list === 'books' || list === 'sessions') && Number.isInteger(position)) {
    const item = `${list === 'books' ? 'Book' : 'Session'} ${position + 1}`;
    return field ? `${item}, ${fieldLabels[field] ?? field}` : item;
  }
  return path === '_' ? '' : (fieldLabels[path] ?? path);
}

/** Up to `max` readable problems from a failed import, then "and N more". */
export function backupErrorLines(error: unknown, max = 5): string[] {
  if (!(error instanceof ApiRequestError)) {
    return [error instanceof Error ? error.message : 'Something went wrong. Try again.'];
  }
  const lines = Object.entries(error.fields).flatMap(([path, messages]) => {
    const label = backupPathLabel(path);
    return messages.map((message) => (label ? `${label}: ${message}` : message));
  });
  if (lines.length === 0) return [error.message];
  const shown = lines.slice(0, max);
  if (lines.length > max) shown.push(`…and ${formatCount(lines.length - max)} more`);
  return shown;
}

const plural = (count: number, one: string, many: string) =>
  `${formatCount(count)} ${count === 1 ? one : many}`;

/** "Added 2 books and 14 sessions. 1 book was already in your library." */
export function importSummary({ books, sessions }: ImportBackupResponse): string {
  if (books.added === 0 && sessions.added === 0) {
    return 'Nothing new: everything in this file is already in your library.';
  }
  const parts = [
    `Added ${plural(books.added, 'book', 'books')} and ${plural(sessions.added, 'session', 'sessions')}.`,
  ];
  if (books.matched > 0) {
    parts.push(`${plural(books.matched, 'book was', 'books were')} already in your library.`);
  }
  if (sessions.skipped > 0) {
    parts.push(`${plural(sessions.skipped, 'session was', 'sessions were')} already logged.`);
  }
  return parts.join(' ');
}
