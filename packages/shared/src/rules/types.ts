/** A stored session as the rules see it. A running timer has no `endedAt` / `endPage`. */
export interface SessionRecord {
  id: string;
  bookId: string;
  startedAt: Date;
  endedAt: Date | null;
  startPage: number;
  endPage: number | null;
  pausedSeconds: number;
}

export interface CompletedSession extends SessionRecord {
  endedAt: Date;
  endPage: number;
}

/** A session about to be saved (new, edited or a stopped timer). `id` is set when editing. */
export interface SessionDraft {
  id?: string;
  bookId: string;
  startedAt: Date;
  endedAt: Date;
  startPage: number;
  endPage: number;
  pausedSeconds?: number;
}

export const isCompleted = <T extends SessionRecord>(s: T): s is T & CompletedSession =>
  s.endedAt !== null && s.endPage !== null;
