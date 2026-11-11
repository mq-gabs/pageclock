import { describe, expect, it } from 'vitest';
import type { BookWithProgress } from '../schemas/books';
import type { TimerOp } from '../schemas/timer';
import { applyTimerOp, applyTimerOps, type LocalTimer } from './timer-ops';

const book: BookWithProgress = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Piranesi',
  author: 'Susanna Clarke',
  totalPages: 272,
  status: 'reading',
  finishedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  progress: 40,
  percent: 15,
};
const sessionId = '22222222-2222-4222-8222-222222222222';
const otherId = '33333333-3333-4333-8333-333333333333';
let n = 0;
const opId = () => `op-${++n}`;

const start = (at = '2026-10-27T23:10:00.000Z', startPage?: number): TimerOp => ({
  kind: 'start',
  opId: opId(),
  sessionId,
  at,
  book,
  ...(startPage ? { startPage } : {}),
});
const pause = (at: string, id = sessionId): TimerOp => ({
  kind: 'pause',
  opId: opId(),
  sessionId: id,
  at,
});
const resume = (at: string): TimerOp => ({ kind: 'resume', opId: opId(), sessionId, at });

describe('applyTimerOp', () => {
  it('starts a timer at the click time, with the start page unknown until the API applies rule 1', () => {
    const timer = applyTimerOp(null, start());
    expect(timer?.session).toMatchObject({
      id: sessionId,
      bookId: book.id,
      startedAt: '2026-10-27T23:10:00.000Z',
      pausedAt: null,
      pausedSeconds: 0,
      startPage: null,
      endedAt: null,
      source: 'timer',
    });
    expect(timer?.book).toBe(book);
    expect(applyTimerOp(null, start(undefined, 41))?.session.startPage).toBe(41);
  });

  it('keeps a running timer on Start (the same session, or another one the API keeps)', () => {
    const timer = applyTimerOp(null, start())!;
    expect(applyTimerOp(timer, start('2026-10-28T00:00:00.000Z'))).toBe(timer);
    expect(applyTimerOp(timer, { ...start(), sessionId: otherId })).toBe(timer);
  });

  it('pauses and resumes at the click times, adding the pause to pausedSeconds', () => {
    const timer = applyTimerOps(null, [
      start(),
      pause('2026-10-27T23:30:00.000Z'),
      resume('2026-10-27T23:35:00.400Z'),
    ]);
    expect(timer?.session).toMatchObject({ pausedAt: null, pausedSeconds: 300 });
  });

  it('is harmless when the same action is applied twice', () => {
    const p = pause('2026-10-27T23:30:00.000Z');
    const paused = applyTimerOps(null, [start(), p]);
    expect(applyTimerOp(paused, p)).toBe(paused);
    expect(applyTimerOp(paused, pause('2026-10-27T23:31:00.000Z'))).toBe(paused);

    const r = resume('2026-10-27T23:35:00.000Z');
    const resumed = applyTimerOp(paused, r);
    expect(applyTimerOp(resumed, r)).toBe(resumed);
  });

  it('ignores a resume without a pause', () => {
    const timer = applyTimerOp(null, start());
    expect(applyTimerOp(timer, resume('2026-10-27T23:35:00.000Z'))).toBe(timer);
  });

  it('ignores actions for another session or without a timer', () => {
    const timer = applyTimerOp(null, start());
    expect(applyTimerOp(timer, pause('2026-10-27T23:30:00.000Z', otherId))).toBe(timer);
    expect(applyTimerOp(null, pause('2026-10-27T23:30:00.000Z'))).toBeNull();
  });

  it('changes the start page and discards the timer', () => {
    const timer = applyTimerOp(null, start());
    const moved = applyTimerOp(timer, {
      kind: 'startPage',
      opId: opId(),
      sessionId,
      startPage: 41,
    });
    expect(moved?.session.startPage).toBe(41);
    expect(applyTimerOp(moved, { kind: 'discard', opId: opId(), sessionId })).toBeNull();
    expect(applyTimerOp(moved, { kind: 'discard', opId: opId(), sessionId: otherId })).toBe(moved);
  });

  it('pauses before and resumes after midnight in America/Fortaleza', () => {
    const timer = applyTimerOps(null, [
      start('2026-10-28T02:40:00.000Z'), // 23:40
      pause('2026-10-28T02:58:00.000Z'), // 23:58
      resume('2026-10-28T03:04:00.000Z'), // 00:04 the next day
    ]) as LocalTimer;
    expect(timer.session).toMatchObject({
      startedAt: '2026-10-28T02:40:00.000Z',
      pausedAt: null,
      pausedSeconds: 360,
    });
  });
});
