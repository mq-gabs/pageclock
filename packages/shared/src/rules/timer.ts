import type { SessionIssue } from '../schemas/sessions';
import type { SessionRecord } from './types';

/** A running timer as rule 5 sees it: paused while `pausedAt` is set. */
export type TimerState = Pick<SessionRecord, 'startedAt' | 'pausedSeconds'> & {
  pausedAt: Date | null;
};

/** When the session ends if stopped now: a paused timer ended when it was paused. */
export const timerEndedAt = (timer: TimerState, now: Date): Date => timer.pausedAt ?? now;

/** Whole seconds read so far: time since the start minus pauses; frozen while paused. */
export function timerElapsedSeconds(timer: TimerState, now: Date): number {
  const ms = timerEndedAt(timer, now).getTime() - timer.startedAt.getTime();
  return Math.max(0, Math.floor(ms / 1000) - timer.pausedSeconds);
}

/** Rule 5: resuming adds the time spent paused to `pausedSeconds`. */
export function pausedSecondsAfterResume(timer: TimerState, now: Date): number {
  if (!timer.pausedAt) return timer.pausedSeconds;
  const paused = Math.round((now.getTime() - timer.pausedAt.getTime()) / 1000);
  return timer.pausedSeconds + Math.max(0, paused);
}

/**
 * A timer's start page must be a page of the book, so it can end on that page or later
 * (rule 2). Pages below 1 are rejected by the request schema.
 */
export function validateTimerStartPage(startPage: number, totalPages: number): SessionIssue[] {
  if (startPage <= totalPages) return [];
  return [
    {
      field: 'startPage',
      code: 'start_page_above_total',
      message: `Start page can’t be above the book’s ${totalPages} pages.`,
    },
  ];
}
