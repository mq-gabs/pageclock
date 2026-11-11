import type { StartTimerInput } from '@reading-tracker/shared';

/** A `POST /api/timer/start` body clicked now, with fresh action and session ids. */
export const startTimerBody = (bookId: string, startPage?: number): StartTimerInput => ({
  opId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  bookId,
  startedAt: new Date().toISOString(),
  ...(startPage === undefined ? {} : { startPage }),
});
