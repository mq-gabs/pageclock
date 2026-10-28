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

export const apiWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  suggestion: z.record(z.string(), z.unknown()).optional(),
});
export type ApiWarning = z.infer<typeof apiWarningSchema>;

export const apiWarningsResponseSchema = z.object({
  warnings: z.array(apiWarningSchema),
});
export type ApiWarningsResponse = z.infer<typeof apiWarningsResponseSchema>;
