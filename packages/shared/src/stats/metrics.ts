import { isCompleted, type CompletedSession, type SessionRecord } from '../rules/types';

/** Pages read = end page − start page + 1 (both pages count: 13 → 20 is 8 pages). */
export const sessionPages = (s: Pick<CompletedSession, 'startPage' | 'endPage'>): number =>
  s.endPage - s.startPage + 1;

/** Minutes = end time − start time, minus time spent paused (0 for manual sessions). */
export function sessionMinutes(
  s: Pick<CompletedSession, 'startedAt' | 'endedAt' | 'pausedSeconds'>,
): number {
  const ms = s.endedAt.getTime() - s.startedAt.getTime() - s.pausedSeconds * 1000;
  return Math.max(0, ms / 60_000);
}

/** Speed = pages ÷ minutes × 60, in pages per hour; null without reading time. */
export function readingSpeed(pages: number, minutes: number): number | null {
  return minutes > 0 ? (pages / minutes) * 60 : null;
}

export interface Totals {
  pages: number;
  minutes: number;
  sessions: number;
  /** Pages per hour. */
  speed: number | null;
}

/** Totals over completed sessions; running timers are ignored. */
export function totals(sessions: readonly SessionRecord[]): Totals {
  let pages = 0;
  let minutes = 0;
  let count = 0;
  for (const s of sessions) {
    if (!isCompleted(s)) continue;
    pages += sessionPages(s);
    minutes += sessionMinutes(s);
    count++;
  }
  return { pages, minutes, sessions: count, speed: readingSpeed(pages, minutes) };
}
