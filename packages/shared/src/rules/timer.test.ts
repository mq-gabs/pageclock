import { describe, expect, it } from 'vitest';
import {
  acceptTimerAction,
  acceptTimerStart,
  clampToNow,
  pausedSecondsAfterResume,
  timerElapsedSeconds,
  timerEndedAt,
  validateTimerStartPage,
  type TimerState,
} from './timer';

const startedAt = new Date('2026-10-27T23:10:00Z'); // 20:10 in Fortaleza
const at = (iso: string) => new Date(iso);

describe('timerElapsedSeconds', () => {
  it('counts whole seconds since the start', () => {
    const timer: TimerState = { startedAt, pausedAt: null, pausedSeconds: 0 };
    expect(timerElapsedSeconds(timer, at('2026-10-27T23:51:12.900Z'))).toBe(41 * 60 + 12);
  });

  it('subtracts earlier pauses', () => {
    const timer: TimerState = { startedAt, pausedAt: null, pausedSeconds: 300 };
    expect(timerElapsedSeconds(timer, at('2026-10-27T23:51:00Z'))).toBe(36 * 60);
  });

  it('freezes while paused', () => {
    const timer: TimerState = {
      startedAt,
      pausedAt: at('2026-10-27T23:30:00Z'),
      pausedSeconds: 60,
    };
    expect(timerElapsedSeconds(timer, at('2026-10-27T23:31:00Z'))).toBe(19 * 60);
    expect(timerElapsedSeconds(timer, at('2026-10-28T02:00:00Z'))).toBe(19 * 60);
  });

  it('runs past midnight in America/Fortaleza without resetting', () => {
    const late: TimerState = {
      startedAt: at('2026-10-28T02:50:00Z'),
      pausedAt: null,
      pausedSeconds: 0,
    };
    expect(timerElapsedSeconds(late, at('2026-10-28T03:20:00Z'))).toBe(30 * 60); // 23:50 → 00:20
  });

  it('never goes below zero when the clock is behind the start', () => {
    const timer: TimerState = { startedAt, pausedAt: null, pausedSeconds: 0 };
    expect(timerElapsedSeconds(timer, at('2026-10-27T23:09:00Z'))).toBe(0);
  });
});

describe('timerEndedAt', () => {
  it('is now while running and the pause time while paused', () => {
    const now = at('2026-10-27T23:51:00Z');
    expect(timerEndedAt({ startedAt, pausedAt: null, pausedSeconds: 0 }, now)).toEqual(now);
    const pausedAt = at('2026-10-27T23:40:00Z');
    expect(timerEndedAt({ startedAt, pausedAt, pausedSeconds: 0 }, now)).toEqual(pausedAt);
  });
});

describe('pausedSecondsAfterResume', () => {
  it('adds the time spent paused', () => {
    const timer: TimerState = {
      startedAt,
      pausedAt: at('2026-10-27T23:30:00Z'),
      pausedSeconds: 60,
    };
    expect(pausedSecondsAfterResume(timer, at('2026-10-27T23:35:00.400Z'))).toBe(360);
  });

  it('leaves a running timer alone', () => {
    const timer: TimerState = { startedAt, pausedAt: null, pausedSeconds: 90 };
    expect(pausedSecondsAfterResume(timer, at('2026-10-27T23:35:00Z'))).toBe(90);
  });
});

describe('validateTimerStartPage', () => {
  it('accepts every page of the book, the last one included', () => {
    expect(validateTimerStartPage(1, 320)).toEqual([]);
    expect(validateTimerStartPage(320, 320)).toEqual([]);
  });

  it('rejects pages beyond the last one', () => {
    expect(validateTimerStartPage(321, 320)).toEqual([
      expect.objectContaining({ field: 'startPage', code: 'start_page_above_total' }),
    ]);
  });
});

describe('rule 5a: accepted click times', () => {
  const now = at('2026-10-28T00:00:00Z');
  const running: TimerState = { startedAt, pausedAt: null, pausedSeconds: 0 };
  const paused: TimerState = { startedAt, pausedAt: at('2026-10-27T23:30:00Z'), pausedSeconds: 0 };

  it('keeps a click time in the past, as clicked', () => {
    const clicked = at('2026-10-27T23:40:00Z');
    expect(acceptTimerAction(running, 'pause', clicked, now)).toEqual({ at: clicked, issue: null });
    expect(acceptTimerStart(clicked, now)).toEqual({ at: clicked, issue: null });
  });

  it('clamps a click time ahead of the server clock to now', () => {
    expect(clampToNow(at('2026-10-28T00:00:01Z'), now)).toEqual(now);
    expect(clampToNow(at('2026-10-28T03:00:00Z'), now)).toEqual(now);
    expect(acceptTimerAction(running, 'pause', at('2026-10-28T00:05:00Z'), now)).toEqual({
      at: now,
      issue: null,
    });
    expect(acceptTimerStart(at('2026-10-28T00:05:00Z'), now).at).toEqual(now);
  });

  it('rejects a pause or resume before the session started', () => {
    const early = at('2026-10-27T23:09:59Z');
    expect(acceptTimerAction(running, 'pause', early, now).issue?.code).toBe('action_before_start');
    expect(acceptTimerAction(paused, 'resume', early, now).issue?.code).toBe('action_before_start');
  });

  it('rejects a resume before its pause, and accepts one at the same moment', () => {
    expect(acceptTimerAction(paused, 'resume', at('2026-10-27T23:29:59Z'), now).issue?.code).toBe(
      'resume_before_pause',
    );
    expect(acceptTimerAction(paused, 'resume', paused.pausedAt!, now).issue).toBeNull();
  });

  it('applies the 12 h limit of rule 2', () => {
    const later = at('2026-10-28T12:00:00Z');
    expect(acceptTimerAction(running, 'pause', at('2026-10-28T11:10:00Z'), later).issue).toBeNull();
    expect(acceptTimerAction(running, 'pause', at('2026-10-28T11:10:01Z'), later).issue?.code).toBe(
      'too_long',
    );
    expect(acceptTimerStart(at('2026-10-27T23:59:59Z'), later).issue?.code).toBe('too_long');
    expect(acceptTimerStart(at('2026-10-28T00:00:00Z'), later).issue).toBeNull();
  });

  it('accepts a pause and resume around midnight in America/Fortaleza', () => {
    const late: TimerState = {
      startedAt: at('2026-10-28T02:40:00Z'), // 23:40
      pausedAt: at('2026-10-28T02:58:00Z'), // 23:58
      pausedSeconds: 0,
    };
    const resumedAt = at('2026-10-28T03:04:00Z'); // 00:04 the next day
    expect(acceptTimerAction(late, 'resume', resumedAt, at('2026-10-28T03:05:00Z'))).toEqual({
      at: resumedAt,
      issue: null,
    });
    expect(pausedSecondsAfterResume(late, resumedAt)).toBe(6 * 60);
  });
});
