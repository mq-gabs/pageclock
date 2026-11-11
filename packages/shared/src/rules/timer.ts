import type { SessionIssue } from '../schemas/sessions';
import type { SessionRecord } from './types';
import { MAX_SESSION_MS } from './validate-session';

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

export const timerTimeIssueCodes = [
  'action_before_start',
  'resume_before_pause',
  'too_long',
] as const;
export type TimerTimeIssueCode = (typeof timerTimeIssueCodes)[number];
export type TimerTimeIssue = { code: TimerTimeIssueCode; message: string };

/** The click time the API stores, or why it can't (HTTP 400). */
export type AcceptedTime = { at: Date; issue: TimerTimeIssue | null };

/**
 * Rule 5a: a click time after the server's clock is clamped to the server's "now". The device
 * stamps clicks with an estimate of the server clock (to the second, from the `Date` header),
 * so small leads are normal; a stored time in the future would also make the stop fail rule 2.
 */
export const clampToNow = (at: Date, now: Date): Date => (at.getTime() > now.getTime() ? now : at);

const tooLong: TimerTimeIssue = {
  code: 'too_long',
  message: 'A session can be at most 12 hours long.',
};

/** Rule 5a for Start: the click time, clamped, no more than 12 h ago (rule 2). */
export function acceptTimerStart(startedAt: Date, now: Date): AcceptedTime {
  const at = clampToNow(startedAt, now);
  const issue = now.getTime() - at.getTime() > MAX_SESSION_MS ? tooLong : null;
  return { at, issue };
}

/**
 * Rule 5a for Pause and Resume: the click time, clamped, not before the session started, a
 * resume not before its pause, and within 12 h of the start (rule 2).
 */
export function acceptTimerAction(
  timer: TimerState,
  kind: 'pause' | 'resume',
  clickedAt: Date,
  now: Date,
): AcceptedTime {
  const at = clampToNow(clickedAt, now);
  let issue: TimerTimeIssue | null = null;
  if (at.getTime() < timer.startedAt.getTime()) {
    issue = {
      code: 'action_before_start',
      message: `The ${kind} can’t be before the session started.`,
    };
  } else if (kind === 'resume' && timer.pausedAt && at.getTime() < timer.pausedAt.getTime()) {
    issue = { code: 'resume_before_pause', message: 'The resume can’t be before the pause.' };
  } else if (at.getTime() - timer.startedAt.getTime() > MAX_SESSION_MS) {
    issue = tooLong;
  }
  return { at, issue };
}
