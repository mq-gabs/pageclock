import { z } from 'zod';
import { bookWithProgressSchema } from './books';
import { sessionSchema } from './sessions';

const startPage = z.int('Use a whole page number').min(1, 'Start page must be at least 1');
const isoDate = z.iso.datetime({ offset: true, error: 'Expected an ISO date-time' });

/**
 * Every queued timer action carries an `opId` (so the API recognises a retry) and the
 * `sessionId` the browser generated at Start (so it can name the session before the server
 * has answered).
 */
const timerAction = {
  opId: z.uuid('Not a valid action id'),
  sessionId: z.uuid('Not a valid session id'),
};

/**
 * Body of `POST /api/timer/start`. `startedAt` is the moment of the click (rule 5a); without
 * `startPage` the API applies rule 1 at that moment.
 */
export const startTimerSchema = z.object({
  ...timerAction,
  bookId: z.uuid('Not a valid book id'),
  startedAt: isoDate,
  startPage: startPage.optional(),
});
export type StartTimerInput = z.infer<typeof startTimerSchema>;

/** Body of `POST /api/timer/pause` and `/resume`: `at` is the moment of the click (rule 5a). */
export const timerActionSchema = z.object({ ...timerAction, at: isoDate });
export type TimerActionInput = z.infer<typeof timerActionSchema>;

/** Body of `PATCH /api/timer`: change the running timer's start page. */
export const updateTimerSchema = z.object({ ...timerAction, startPage });
export type UpdateTimerInput = z.infer<typeof updateTimerSchema>;

/** Body of `POST /api/timer/stop`. */
export const stopTimerSchema = z.object({
  endPage: z.int('Use a whole page number'),
  confirmWarnings: z.boolean().optional(),
});
export type StopTimerInput = z.infer<typeof stopTimerSchema>;

/** The running session with its book. */
export const timerSchema = z.object({
  session: sessionSchema,
  book: bookWithProgressSchema,
  /** The book's latest session before the timer started, where rule 1 took the start page from. */
  previous: z.object({ endPage: z.int(), startedAt: z.iso.datetime() }).nullable(),
});
export type Timer = z.infer<typeof timerSchema>;

export const timerResponseSchema = z.object({ timer: timerSchema.nullable() });
export type TimerResponse = z.infer<typeof timerResponseSchema>;

const opTime = z.iso.datetime();

/**
 * A timer action waiting on the device to reach the API (rule 5), as the web queue stores it.
 * Start keeps the book as the device knew it, to show the timer before the API answers.
 */
export const timerOpSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('start'),
    ...timerAction,
    at: opTime,
    book: bookWithProgressSchema,
    startPage: startPage.optional(),
  }),
  z.object({ kind: z.enum(['pause', 'resume']), ...timerAction, at: opTime }),
  z.object({ kind: z.literal('startPage'), ...timerAction, startPage }),
  z.object({ kind: z.literal('discard'), ...timerAction }),
]);
export type TimerOp = z.infer<typeof timerOpSchema>;
export type TimerOpKind = TimerOp['kind'];
