'use client';

import type { BookWithProgress } from '@reading-tracker/shared';
import { useAppRouter } from './navigation-progress';
import { useTimer, useTimerActions } from './queries';

/**
 * "Start reading": start the timer for a book and open /read at once; the timer queue tells
 * the API (rule 1 picks the start page there). With a timer already running, open that one.
 */
export function useStartReading() {
  const router = useAppRouter();
  const timer = useTimer();
  const actions = useTimerActions();
  const start = (book: BookWithProgress) => {
    if (!timer.data) actions.start(book);
    router.push('/read');
  };
  return { start, disabled: timer.isPending };
}
