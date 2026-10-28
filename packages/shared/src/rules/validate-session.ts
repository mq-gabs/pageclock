import type { SessionIssue } from '../schemas/sessions';
import type { SessionDraft } from './types';

export const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

/** Rule 2: hard validation. Any issue blocks saving (HTTP 400). */
export function validateSession(
  draft: Pick<SessionDraft, 'startedAt' | 'endedAt' | 'startPage' | 'endPage'>,
  context: { totalPages: number; now: Date },
): SessionIssue[] {
  const issues: SessionIssue[] = [];
  const start = draft.startedAt.getTime();
  const end = draft.endedAt.getTime();

  if (end <= start) {
    issues.push({
      field: 'endedAt',
      code: 'ended_before_start',
      message: 'End time must be after the start time.',
    });
  } else if (end - start > MAX_SESSION_MS) {
    issues.push({
      field: 'endedAt',
      code: 'too_long',
      message: 'A session can be at most 12 hours long.',
    });
  }
  if (end > context.now.getTime()) {
    issues.push({
      field: 'endedAt',
      code: 'ended_in_future',
      message: 'End time can’t be in the future.',
    });
  }

  if (draft.startPage < 0) {
    issues.push({
      field: 'startPage',
      code: 'start_page_negative',
      message: 'Start page can’t be negative.',
    });
  }
  if (draft.endPage <= draft.startPage) {
    issues.push({
      field: 'endPage',
      code: 'end_page_not_after_start',
      message: 'End page must be greater than the start page.',
    });
  }
  if (draft.endPage > context.totalPages) {
    issues.push({
      field: 'endPage',
      code: 'end_page_above_total',
      message: `End page can’t be above the book’s ${context.totalPages} pages.`,
    });
  }
  return issues;
}

/** Groups issues into the API error `fields` shape: `{ endPage: ['…'] }`. */
export function issuesToFields(issues: readonly SessionIssue[]): Record<string, string[]> {
  const fields: Record<string, string[]> = {};
  for (const issue of issues) (fields[issue.field] ??= []).push(issue.message);
  return fields;
}
