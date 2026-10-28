import type { SessionDraft, SessionRecord } from './rules/types';

let counter = 0;

/** A completed session; times are ISO strings, pages default to 0 → 10. */
export function session(
  fields: Partial<Omit<SessionRecord, 'startedAt' | 'endedAt'>> & {
    start: string;
    end?: string | null;
  },
): SessionRecord {
  const { start, end, ...rest } = fields;
  return {
    id: `s${++counter}`,
    bookId: 'book-1',
    startPage: 0,
    endPage: 10,
    pausedSeconds: 0,
    ...rest,
    startedAt: new Date(start),
    endedAt:
      end === null ? null : new Date(end ?? new Date(new Date(start).getTime() + 30 * 60_000)),
  };
}

export function draft(
  fields: Partial<Omit<SessionDraft, 'startedAt' | 'endedAt'>> & { start: string; end: string },
): SessionDraft {
  const { start, end, ...rest } = fields;
  return {
    bookId: 'book-1',
    startPage: 0,
    endPage: 10,
    ...rest,
    startedAt: new Date(start),
    endedAt: new Date(end),
  };
}
