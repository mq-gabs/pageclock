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
