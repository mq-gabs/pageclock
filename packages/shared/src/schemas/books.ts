import { z } from 'zod';

export const bookStatuses = ['want_to_read', 'reading', 'finished'] as const;
export const bookStatusSchema = z.enum(bookStatuses);
export type BookStatus = z.infer<typeof bookStatusSchema>;

export const bookLimits = {
  titleMax: 300,
  authorMax: 200,
  totalPagesMin: 1,
  totalPagesMax: 10000,
} as const;

export const bookSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(bookLimits.titleMax),
  author: z.string().min(1).max(bookLimits.authorMax),
  totalPages: z.int().min(bookLimits.totalPagesMin).max(bookLimits.totalPagesMax),
  status: bookStatusSchema,
  finishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Book = z.infer<typeof bookSchema>;

// `?status=&q=` means "no filter", so empty query values count as missing.
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const listBooksQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, bookStatusSchema.optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(bookLimits.titleMax).optional()),
});
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

export const listBooksResponseSchema = z.object({
  books: z.array(bookSchema),
});
export type ListBooksResponse = z.infer<typeof listBooksResponseSchema>;
