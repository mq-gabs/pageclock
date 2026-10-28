'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bookDetailSchema,
  bookWithProgressSchema,
  listBooksResponseSchema,
  listSessionsResponseSchema,
  saveSessionResponseSchema,
  sessionCheckResponseSchema,
  statsDailyResponseSchema,
  statsStreaksResponseSchema,
  statsSummaryResponseSchema,
  suggestedStartPageResponseSchema,
  timerResponseSchema,
  type CheckSessionBody,
  type CreateBookInput,
  type CreateSessionInput,
  type ListBooksQuery,
  type StartTimerInput,
  type StatsPeriod,
  type StopTimerInput,
  type TimerResponse,
  type UpdateBookInput,
  type UpdateSessionInput,
  type UpdateTimerInput,
} from '@reading-tracker/shared';
import { api, apiNoContent } from './api';

export const bookKeys = {
  all: ['books'] as const,
  list: (query: ListBooksQuery) => ['books', 'list', query] as const,
  detail: (id: string) => ['books', 'detail', id] as const,
  sessions: (id: string) => ['books', 'sessions', id] as const,
  // Stats live under 'books' so every book and session change refreshes them.
  summary: (period: StatsPeriod, date: string | undefined) =>
    ['books', 'stats', 'summary', period, date ?? 'today'] as const,
  daily: (from: string, to: string) => ['books', 'stats', 'daily', from, to] as const,
  streaks: ['books', 'stats', 'streaks'] as const,
};

export function useBooks(query: ListBooksQuery) {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.q) params.set('q', query.q);
  const search = params.size > 0 ? `?${params}` : '';
  return useQuery({
    queryKey: bookKeys.list(query),
    queryFn: () => api('GET', `/api/books${search}`, listBooksResponseSchema),
    placeholderData: keepPreviousData,
  });
}

export function useBook(id: string) {
  return useQuery({
    queryKey: bookKeys.detail(id),
    queryFn: () => api('GET', `/api/books/${id}`, bookDetailSchema),
  });
}

export function useCreateBook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookInput) =>
      api('POST', '/api/books', bookWithProgressSchema, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

export function useUpdateBook(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBookInput) =>
      api('PATCH', `/api/books/${id}`, bookWithProgressSchema, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

export function useDeleteBook(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiNoContent('DELETE', `/api/books/${id}`),
    // Only refresh lists: refetching the deleted book's detail would just 404 before the
    // page navigates away.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['books', 'list'] }),
  });
}

export function useBookSessions(bookId: string) {
  return useQuery({
    queryKey: bookKeys.sessions(bookId),
    queryFn: () => api('GET', `/api/books/${bookId}/sessions`, listSessionsResponseSchema),
  });
}

export const fetchSuggestedStartPage = (bookId: string, at: Date) =>
  api(
    'GET',
    `/api/books/${bookId}/suggested-start-page?at=${encodeURIComponent(at.toISOString())}`,
    suggestedStartPageResponseSchema,
  );

export const checkSession = (body: CheckSessionBody) =>
  api('POST', '/api/reading-sessions/check', sessionCheckResponseSchema, body);

export type SaveSessionVariables =
  | { mode: 'create'; input: CreateSessionInput }
  | { mode: 'edit'; sessionId: string; input: UpdateSessionInput };

/** Create or edit a session. Throws `ApiWarningsError` on 409 until `confirmWarnings` is set. */
export function useSaveSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: SaveSessionVariables) =>
      variables.mode === 'create'
        ? api('POST', '/api/reading-sessions', saveSessionResponseSchema, variables.input)
        : api(
            'PATCH',
            `/api/reading-sessions/${variables.sessionId}`,
            saveSessionResponseSchema,
            variables.input,
          ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => apiNoContent('DELETE', `/api/reading-sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: bookKeys.all }),
  });
}

export const timerKey = ['timer'] as const;

/** Rule 5: the running timer comes from the API, so it survives reloads and device switches. */
export function useTimer() {
  return useQuery({
    queryKey: timerKey,
    queryFn: () => api('GET', '/api/timer', timerResponseSchema),
    select: (data) => data.timer,
  });
}

/** Mutations that answer `{ timer }` put it straight into the cache. */
function useTimerMutation<V>(mutationFn: (variables: V) => Promise<TimerResponse>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data) => queryClient.setQueryData(timerKey, data),
    // A 404/409 means the cached timer is stale (stopped or started on another device).
    onError: () => queryClient.invalidateQueries({ queryKey: timerKey }),
  });
}

export const useStartTimer = () =>
  useTimerMutation((input: StartTimerInput) =>
    api('POST', '/api/timer/start', timerResponseSchema, input),
  );

export const useUpdateTimer = () =>
  useTimerMutation((input: UpdateTimerInput) =>
    api('PATCH', '/api/timer', timerResponseSchema, input),
  );

export const usePauseTimer = () =>
  useTimerMutation((action: 'pause' | 'resume') =>
    api('POST', `/api/timer/${action}`, timerResponseSchema),
  );

/** Stop with an end page. Throws `ApiWarningsError` on 409 until `confirmWarnings` is set. */
export function useStopTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: StopTimerInput) =>
      api('POST', '/api/timer/stop', saveSessionResponseSchema, input),
    onSuccess: async () => {
      queryClient.setQueryData<TimerResponse>(timerKey, { timer: null });
      await queryClient.invalidateQueries({ queryKey: bookKeys.all });
    },
  });
}

/** Throw the running session away. */
export function useDiscardTimer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => apiNoContent('DELETE', `/api/reading-sessions/${sessionId}`),
    onSuccess: async () => {
      queryClient.setQueryData<TimerResponse>(timerKey, { timer: null });
      await queryClient.invalidateQueries({ queryKey: bookKeys.all });
    },
  });
}

/** Without `date` the API uses today; the response says which day that is. */
export function useStatsSummary(period: StatsPeriod, date?: string) {
  const search = new URLSearchParams({ period, ...(date ? { date } : {}) });
  return useQuery({
    queryKey: bookKeys.summary(period, date),
    queryFn: () => api('GET', `/api/stats/summary?${search}`, statsSummaryResponseSchema),
    placeholderData: keepPreviousData,
  });
}

export function useStatsDaily(range: { from: string; to: string } | undefined) {
  return useQuery({
    queryKey: bookKeys.daily(range?.from ?? '', range?.to ?? ''),
    queryFn: () =>
      api('GET', `/api/stats/daily?from=${range?.from}&to=${range?.to}`, statsDailyResponseSchema),
    enabled: range !== undefined,
    placeholderData: keepPreviousData,
  });
}

export function useStreaks() {
  return useQuery({
    queryKey: bookKeys.streaks,
    queryFn: () => api('GET', '/api/stats/streaks', statsStreaksResponseSchema),
  });
}
