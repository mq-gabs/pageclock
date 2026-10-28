import type { SessionRecord } from './types';

type Candidate = Pick<SessionRecord, 'id' | 'startedAt' | 'endPage'>;

/**
 * Rule 1: the end page of the book's latest session that started before `at`, or 0.
 * Pass the book's sessions only. Running sessions (no end page) are skipped, and so is
 * `excludeId`, the session being edited.
 */
export function suggestStartPage(
  sessions: readonly Candidate[],
  at: Date,
  options: { excludeId?: string } = {},
): number {
  let latest: Candidate | undefined;
  for (const s of sessions) {
    if (s.id === options.excludeId || s.endPage === null) continue;
    if (s.startedAt.getTime() >= at.getTime()) continue;
    if (!latest || s.startedAt.getTime() > latest.startedAt.getTime()) latest = s;
  }
  return latest?.endPage ?? 0;
}
