'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bookDetailSchema,
  bookWithProgressSchema,
  listBooksResponseSchema,
  listSessionsResponseSchema,
  saveSessionResponseSchema,
  sessionCheckResponseSchema,
  suggestedStartPageResponseSchema,
  type CheckSessionBody,
  type CreateBookInput,
  type CreateSessionInput,
  type ListBooksQuery,
  type UpdateBookInput,
  type UpdateSessionInput,
} from '@reading-tracker/shared';
import { api, apiNoContent } from './api';

export const bookKeys = {
  all: ['books'] as const,
  list: (query: ListBooksQuery) => ['books', 'list', query] as const,
  detail: (id: string) => ['books', 'detail', id] as const,
  sessions: (id: string) => ['books', 'sessions', id] as const,
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
