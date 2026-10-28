'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bookDetailSchema,
  bookWithProgressSchema,
  listBooksResponseSchema,
  type CreateBookInput,
  type ListBooksQuery,
  type UpdateBookInput,
} from '@reading-tracker/shared';
import { api, apiNoContent } from './api';

export const bookKeys = {
  all: ['books'] as const,
  list: (query: ListBooksQuery) => ['books', 'list', query] as const,
  detail: (id: string) => ['books', 'detail', id] as const,
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
