import { z } from 'zod';

export const sessionSources = ['timer', 'manual'] as const;
export const sessionSourceSchema = z.enum(sessionSources);
export type SessionSource = z.infer<typeof sessionSourceSchema>;

/** Hard-rule failures (rule 2): they block saving. */
export const sessionErrorCodes = [
  'ended_before_start',
  'ended_in_future',
  'too_long',
  'start_page_negative',
  'end_page_not_after_start',
  'end_page_above_total',
  'start_page_not_below_total',
] as const;
export type SessionErrorCode = (typeof sessionErrorCodes)[number];

export const sessionFields = ['startedAt', 'endedAt', 'startPage', 'endPage'] as const;
export type SessionField = (typeof sessionFields)[number];

export const sessionIssueSchema = z.object({
  field: z.enum(sessionFields),
  code: z.enum(sessionErrorCodes),
  message: z.string(),
});
export type SessionIssue = z.infer<typeof sessionIssueSchema>;

/** Page-check findings (rule 3): they warn but can be confirmed. */
export const sessionWarningCodes = [
  'page_gap_before',
  'page_overlap_before',
  'page_gap_after',
  'page_overlap_after',
  'time_overlap',
] as const;
export type SessionWarningCode = (typeof sessionWarningCodes)[number];

const isoDate = z.iso.datetime({ offset: true, error: 'Expected an ISO date-time' });
const page = z.int('Use a whole page number');

/** A stored session as the API returns it, with computed metrics once it has ended. */
export const sessionSchema = z.object({
  id: z.uuid(),
  bookId: z.uuid(),
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  pausedAt: z.iso.datetime().nullable(),
  pausedSeconds: z.int(),
  startPage: z.int(),
  endPage: z.int().nullable(),
  source: sessionSourceSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Pages read, reading minutes and pages/hour; null while the timer runs. */
  metrics: z
    .object({ pages: z.int(), minutes: z.number(), speed: z.number().nullable() })
    .nullable(),
});
export type Session = z.infer<typeof sessionSchema>;

export const listSessionsResponseSchema = z.object({ sessions: z.array(sessionSchema) });
export type ListSessionsResponse = z.infer<typeof listSessionsResponseSchema>;

/** Body of `POST /api/reading-sessions` (a manual log). */
export const createSessionSchema = z.object({
  bookId: z.uuid('Not a valid book id'),
  startedAt: isoDate,
  endedAt: isoDate,
  startPage: page,
  endPage: page,
  confirmWarnings: z.boolean().optional(),
});
export type CreateSessionInput = z.infer<typeof createSessionSchema>;

/** Body of `PATCH /api/reading-sessions/:id`: any of the editable fields. */
export const updateSessionSchema = z.object({
  startedAt: isoDate.optional(),
  endedAt: isoDate.optional(),
  startPage: page.optional(),
  endPage: page.optional(),
  confirmWarnings: z.boolean().optional(),
});
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;

/** Body of `POST /api/reading-sessions/check`; `id` is the session being edited. */
export const checkSessionBodySchema = createSessionSchema
  .omit({ confirmWarnings: true })
  .extend({ id: z.uuid().optional() });
export type CheckSessionBody = z.infer<typeof checkSessionBodySchema>;

export const sessionWarningSchema = z.object({
  code: z.enum(sessionWarningCodes),
  message: z.string(),
  suggestion: z
    .object({
      startPage: z.int().optional(),
      endPage: z.int().optional(),
      startedAt: z.iso.datetime().optional(),
      endedAt: z.iso.datetime().optional(),
    })
    .optional(),
  sessionId: z.string().optional(),
});

export const sessionCheckResponseSchema = z.object({
  errors: z.array(sessionIssueSchema),
  warnings: z.array(sessionWarningSchema),
  suggestedStartPage: z.int(),
});
export type SessionCheckResponse = z.infer<typeof sessionCheckResponseSchema>;

/** 409 body when a save has warnings and `confirmWarnings` wasn't set. */
export const sessionWarningsResponseSchema = z.object({ warnings: z.array(sessionWarningSchema) });

export const sessionIdParamsSchema = z.object({ id: z.uuid('Not a valid session id') });

export const suggestedStartPageQuerySchema = z.object({ at: isoDate.optional() });
export const suggestedStartPageResponseSchema = z.object({ startPage: z.int() });
