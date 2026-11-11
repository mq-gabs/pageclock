import type { Session } from '../schemas/sessions';
import type { Timer, TimerOp } from '../schemas/timer';
import { pausedSecondsAfterResume } from './timer';

/**
 * A timer as the device shows it: the server's, with waiting actions applied. `startPage` is
 * null after a waiting Start without a chosen page, since rule 1 runs on the server.
 */
export type LocalTimer = Omit<Timer, 'session'> & {
  session: Omit<Session, 'startPage'> & { startPage: number | null };
};

/**
 * Returns `timer` with one waiting action applied. Actions for another session, and actions
 * that are already reflected (a second pause, a resume while running, a start of the running
 * session), leave it unchanged, so applying the same action twice is harmless.
 */
export function applyTimerOp(timer: LocalTimer | null, op: TimerOp): LocalTimer | null {
  if (op.kind === 'start') {
    if (timer) return timer; // The same session, or another one the API will keep (409).
    return {
      session: {
        id: op.sessionId,
        bookId: op.book.id,
        startedAt: op.at,
        endedAt: null,
        pausedAt: null,
        pausedSeconds: 0,
        startPage: op.startPage ?? null,
        endPage: null,
        source: 'timer',
        createdAt: op.at,
        updatedAt: op.at,
        metrics: null,
      },
      book: op.book,
      previous: null,
    };
  }

  if (!timer || timer.session.id !== op.sessionId) return timer;
  const { session } = timer;
  switch (op.kind) {
    case 'pause':
      if (session.pausedAt) return timer;
      return { ...timer, session: { ...session, pausedAt: op.at } };
    case 'resume': {
      if (!session.pausedAt) return timer;
      const pausedSeconds = pausedSecondsAfterResume(
        {
          startedAt: new Date(session.startedAt),
          pausedAt: new Date(session.pausedAt),
          pausedSeconds: session.pausedSeconds,
        },
        new Date(op.at),
      );
      return { ...timer, session: { ...session, pausedAt: null, pausedSeconds } };
    }
    case 'startPage':
      return { ...timer, session: { ...session, startPage: op.startPage } };
    case 'discard':
      return null;
  }
}

/** The server timer with every waiting action applied, in order. */
export const applyTimerOps = (timer: LocalTimer | null, ops: readonly TimerOp[]) =>
  ops.reduce(applyTimerOp, timer);
