import type { SessionIssue } from '../schemas/sessions';
import { checkPages, type SessionWarning } from './check-pages';
import { suggestStartPage } from './suggest-start-page';
import type { SessionDraft, SessionRecord } from './types';
import { validateSession } from './validate-session';

export interface SessionCheck {
  errors: SessionIssue[];
  warnings: SessionWarning[];
  suggestedStartPage: number;
}

/**
 * Rules 1–3 together, as `POST /api/reading-sessions/check` returns them. `sessions` holds
 * the book's sessions plus any other sessions that might overlap in time.
 */
export function checkSession(
  draft: SessionDraft,
  sessions: readonly SessionRecord[],
  context: { totalPages: number; now: Date },
): SessionCheck {
  const bookSessions = sessions.filter((s) => s.bookId === draft.bookId);
  return {
    errors: validateSession(draft, context),
    warnings: checkPages(draft, sessions, { now: context.now }),
    suggestedStartPage: suggestStartPage(bookSessions, draft.startedAt, context.totalPages, {
      excludeId: draft.id,
    }),
  };
}
