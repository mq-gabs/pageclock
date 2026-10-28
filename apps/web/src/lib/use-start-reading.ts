'use client';

import { ApiRequestError } from './api';
import { useAppRouter } from './navigation-progress';
import { useStartTimer } from './queries';

/** "Start reading": start the timer for a book (rule 1 picks the start page) and open /read. */
export function useStartReading() {
  const router = useAppRouter();
  const mutation = useStartTimer();
  // mutateAsync: the caller may unmount once the timer lands in the cache (e.g. the /read picker).
  const start = (bookId: string) =>
    mutation.mutateAsync({ bookId }).then(
      () => router.push('/read'),
      (error: unknown) => {
        // Another timer is already running: show it instead.
        if (error instanceof ApiRequestError && error.code === 'timer_running')
          router.push('/read');
      },
    );
  return { start, isPending: mutation.isPending, error: mutation.error };
}
