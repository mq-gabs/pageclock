import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  time: z.iso.datetime(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fields: z.record(z.string(), z.array(z.string())).optional(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;

/** A change that resolves a warning, e.g. `{ startPage: 174 }`. Times are ISO strings. */
export const warningSuggestionSchema = z.object({
  startPage: z.int().optional(),
  endPage: z.int().optional(),
  startedAt: z.iso.datetime().optional(),
  endedAt: z.iso.datetime().optional(),
});
export type WarningSuggestion = z.infer<typeof warningSuggestionSchema>;

export const apiWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  suggestion: warningSuggestionSchema.optional(),
  /** The other session the warning is about. */
  sessionId: z.string().optional(),
});
export type ApiWarning = z.infer<typeof apiWarningSchema>;

export const apiWarningsResponseSchema = z.object({
  warnings: z.array(apiWarningSchema),
});
export type ApiWarningsResponse = z.infer<typeof apiWarningsResponseSchema>;
