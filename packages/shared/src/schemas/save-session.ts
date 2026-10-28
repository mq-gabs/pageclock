import { z } from 'zod';
import { bookWithProgressSchema } from './books';
import { sessionSchema } from './sessions';

export const saveSessionResponseSchema = z.object({
  session: sessionSchema,
  book: bookWithProgressSchema,
  /** Rule 6: the session reached the last page of a book that isn't finished. */
  offerFinish: z.boolean(),
});
export type SaveSessionResponse = z.infer<typeof saveSessionResponseSchema>;
