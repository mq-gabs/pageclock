import type { ApiWarning } from '../schemas/api';
import type { SessionWarningCode } from '../schemas/sessions';
import { isCompleted, type SessionDraft, type SessionRecord } from './types';

export interface SessionWarning extends ApiWarning {
  code: SessionWarningCode;
}

const pageRange = (from: number, to: number) =>
  from === to ? `Page ${from} is` : `Pages ${from}–${to} are`;

/**
 * Rule 3: compare a draft with its neighbours and warn (don't block).
 *
 * Pages read in a session are startPage … endPage (both included), so a session continues the
 * previous one when its start page is the page after the previous end page.
 *
 * - Pages: against the same book's sessions just before (startedAt ≤ draft, ties count as
 *   before) and just after (startedAt > draft).
 * - Time: against every session passed in, from any book. A running timer counts until `now`.
 *
 * The draft itself (same `id`) is ignored. Suggestions are only given when applying them
 * would still leave a valid page or time range.
 */
export function checkPages(
  draft: SessionDraft,
  sessions: readonly SessionRecord[],
  options: { now?: Date } = {},
): SessionWarning[] {
  const others = sessions.filter((s) => s.id !== draft.id);
  const start = draft.startedAt.getTime();
  const warnings: SessionWarning[] = [];

  let prev: SessionRecord | undefined;
  let next: SessionRecord | undefined;
  for (const s of others) {
    if (s.bookId !== draft.bookId) continue;
    const t = s.startedAt.getTime();
    if (t <= start) {
      if (!prev || t > prev.startedAt.getTime()) prev = s;
    } else if (!next || t < next.startedAt.getTime()) {
      next = s;
    }
  }

  if (prev && prev.endPage !== null) {
    const continues = prev.endPage + 1;
    const fix = continues <= draft.endPage ? { startPage: continues } : undefined;
    if (draft.startPage > continues) {
      warnings.push({
        code: 'page_gap_before',
        message: `${pageRange(continues, draft.startPage - 1)} skipped: the previous session ended on page ${prev.endPage}.`,
        suggestion: fix,
        sessionId: prev.id,
      });
    } else if (draft.startPage < continues) {
      warnings.push({
        code: 'page_overlap_before',
        message: `${pageRange(draft.startPage, prev.endPage)} counted twice: the previous session ended on page ${prev.endPage}.`,
        suggestion: fix,
        sessionId: prev.id,
      });
    }
  }

  if (next) {
    const continues = next.startPage - 1;
    const fix = continues >= draft.startPage ? { endPage: continues } : undefined;
    if (draft.endPage < continues) {
      warnings.push({
        code: 'page_gap_after',
        message: `${pageRange(draft.endPage + 1, continues)} skipped: the next session starts on page ${next.startPage}.`,
        suggestion: fix,
        sessionId: next.id,
      });
    } else if (draft.endPage > continues) {
      warnings.push({
        code: 'page_overlap_after',
        message: `${pageRange(next.startPage, draft.endPage)} counted twice: the next session starts on page ${next.startPage}.`,
        suggestion: fix,
        sessionId: next.id,
      });
    }
  }

  const end = draft.endedAt.getTime();
  for (const s of others) {
    const otherEnd = isCompleted(s) ? s.endedAt : options.now;
    if (!otherEnd) continue;
    const otherStart = s.startedAt.getTime();
    if (!(start < otherEnd.getTime() && otherStart < end)) continue;

    let suggestion: SessionWarning['suggestion'];
    if (otherStart <= start) {
      if (otherEnd.getTime() < end) suggestion = { startedAt: otherEnd.toISOString() };
    } else {
      suggestion = { endedAt: s.startedAt.toISOString() };
    }
    warnings.push({
      code: 'time_overlap',
      message: 'This session overlaps another reading session in time.',
      suggestion,
      sessionId: s.id,
    });
  }

  return warnings;
}
