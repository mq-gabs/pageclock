import { z } from 'zod';
import { bookWithProgressSchema } from './books';
import { sessionSchema } from './sessions';

const startPage = z.int('Use a whole page number').min(1, 'Start page must be at least 1');

/** Body of `POST /api/timer/start`; without `startPage` the API applies rule 1. */
export const startTimerSchema = z.object({
  bookId: z.uuid('Not a valid book id'),
  startPage: startPage.optional(),
});
export type StartTimerInput = z.infer<typeof startTimerSchema>;

/** Body of `PATCH /api/timer`: change the running timer's start page. */
export const updateTimerSchema = z.object({ startPage });
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
