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

/** Rule 1: the end page of the book's latest session that started before `at`, or 0. */
export function suggestStartPage(
  sessions: readonly Candidate[],
  at: Date,
  options: { excludeId?: string } = {},
): number {
  return latestSessionBefore(sessions, at, options)?.endPage ?? 0;
}
