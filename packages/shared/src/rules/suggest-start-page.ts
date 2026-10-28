import type { SessionRecord } from './types';

type Candidate = Pick<SessionRecord, 'id' | 'startedAt' | 'endPage'>;

/**
 * The book's latest finished session that started before `at`. Pass the book's sessions only.
 * Running sessions (no end page) are skipped, and so is `excludeId`, the session being edited.
 */
export function latestSessionBefore<T extends Candidate>(
  sessions: readonly T[],
  at: Date,
  options: { excludeId?: string } = {},
): (T & { endPage: number }) | undefined {
  let latest: (T & { endPage: number }) | undefined;
  for (const s of sessions) {
    if (s.id === options.excludeId || s.endPage === null) continue;
    if (s.startedAt.getTime() >= at.getTime()) continue;
    if (!latest || s.startedAt.getTime() > latest.startedAt.getTime()) {
      latest = s as T & { endPage: number };
    }
  }
  return latest;
}

/**
 * Rule 1: the page after the end page of the book's latest session that started before `at`,
 * or 1 with none. Never above `totalPages`, so a finished book suggests its last page.
 */
export function suggestStartPage(
  sessions: readonly Candidate[],
  at: Date,
  totalPages: number,
  options: { excludeId?: string } = {},
): number {
  const previous = latestSessionBefore(sessions, at, options);
  return previous ? Math.min(previous.endPage + 1, totalPages) : 1;
}
