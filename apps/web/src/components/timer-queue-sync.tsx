'use client';

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiRequestError } from '@/lib/api';
import { timerKey, useMe } from '@/lib/queries';
import { timerQueue } from '@/lib/timer-queue';
import { toast } from '@/lib/toast';

/**
 * Connects the timer queue to the signed-in user (each user has their own stored list) and to
 * the query cache: API answers go into `['timer']`, refused actions refetch it and show why.
 */
export function TimerQueueSync() {
  const queryClient = useQueryClient();
  const userId = useMe().data?.id ?? null;

  useEffect(() => {
    if (!userId) return;
    timerQueue.setUser(userId);
    return () => timerQueue.setUser(null);
  }, [userId]);

  useEffect(() => {
    const offServer = timerQueue.onServer((server) => queryClient.setQueryData(timerKey, server));
    const offRejected = timerQueue.onRejected((error) => {
      void queryClient.invalidateQueries({ queryKey: timerKey });
      toast.error(
        error instanceof ApiRequestError ? error.message : 'The timer couldn’t be updated.',
      );
    });
    return () => {
      offServer();
      offRejected();
    };
  }, [queryClient]);

  return null;
}
