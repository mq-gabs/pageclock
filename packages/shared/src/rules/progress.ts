import type { BookStatus } from '../schemas/books';
import type { SessionRecord } from './types';

/** Rule 7: the furthest page reached, 0 with no sessions. */
export function bookProgress(sessions: readonly Pick<SessionRecord, 'endPage'>[]): number {
  return sessions.reduce((max, s) => Math.max(max, s.endPage ?? 0), 0);
}

export function progressPercent(progress: number, totalPages: number): number {
  if (totalPages <= 0) return 0;
  return Math.round((progress / totalPages) * 100);
}

/** Rule 6: saving the first session moves want_to_read → reading; other statuses stay. */
export function statusAfterSessionSaved(status: BookStatus): BookStatus {
  return status === 'want_to_read' ? 'reading' : status;
}

/** Rule 6: when a saved session reaches the last page, the UI offers "Mark as finished". */
export function shouldOfferFinish(
  status: BookStatus,
  endPage: number,
  totalPages: number,
): boolean {
  return status !== 'finished' && endPage >= totalPages;
}
