import { z } from 'zod';

export const bookStatuses = ['want_to_read', 'reading', 'finished'] as const;
export const bookStatusSchema = z.enum(bookStatuses);
export type BookStatus = z.infer<typeof bookStatusSchema>;

export const bookStatusLabels: Record<BookStatus, string> = {
  want_to_read: 'Want to read',
  reading: 'Reading',
  finished: 'Finished',
};

export const bookLimits = {
  titleMax: 300,
  authorMax: 200,
  totalPagesMin: 1,
  totalPagesMax: 10000,
} as const;

const title = z
  .string()
  .trim()
  .min(1, 'Enter a title')
  .max(bookLimits.titleMax, `Keep the title under ${bookLimits.titleMax} characters`);
const author = z
  .string()
  .trim()
  .min(1, 'Enter an author')
  .max(bookLimits.authorMax, `Keep the author under ${bookLimits.authorMax} characters`);
const totalPages = z
  .number({ error: 'Enter the number of pages' })
  .int('Use a whole number of pages')
  .min(bookLimits.totalPagesMin, 'A book has at least 1 page')
  .max(bookLimits.totalPagesMax, `At most ${bookLimits.totalPagesMax} pages`);

export const bookSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  author: z.string(),
  totalPages: z.int(),
  status: bookStatusSchema,
  finishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Book = z.infer<typeof bookSchema>;

/** A book with its reading progress (rule 7). */
export const bookWithProgressSchema = bookSchema.extend({
  progress: z.int(),
  percent: z.int(),
});
export type BookWithProgress = z.infer<typeof bookWithProgressSchema>;

export const createBookSchema = z.object({ title, author, totalPages });
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z
  .object({ title, author, totalPages, status: bookStatusSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to change');
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const bookIdParamsSchema = z.object({ id: z.uuid('Not a valid book id') });

// `?status=&q=` means "no filter", so empty query values count as missing.
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

export const listBooksQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, bookStatusSchema.optional()),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(bookLimits.titleMax).optional()),
});
export type ListBooksQuery = z.infer<typeof listBooksQuerySchema>;

export const bookCountsSchema = z.object({
  all: z.int(),
  want_to_read: z.int(),
  reading: z.int(),
  finished: z.int(),
});
export type BookCounts = z.infer<typeof bookCountsSchema>;

export const listBooksResponseSchema = z.object({
  books: z.array(bookWithProgressSchema),
  /** Books per status matching `q`, ignoring the status filter (for the filter chips). */
  counts: bookCountsSchema,
});
export type ListBooksResponse = z.infer<typeof listBooksResponseSchema>;

export const bookStatsSchema = z.object({
  pages: z.int(),
  minutes: z.number(),
  sessions: z.int(),
  /** Pages per hour; null without reading time. */
  speed: z.number().nullable(),
  readingDays: z.int(),
  firstReadAt: z.iso.datetime().nullable(),
  lastReadAt: z.iso.datetime().nullable(),
});
export type BookStats = z.infer<typeof bookStatsSchema>;

export const bookDetailSchema = z.object({
  book: bookWithProgressSchema,
  stats: bookStatsSchema,
});
export type BookDetail = z.infer<typeof bookDetailSchema>;
