import { describe, expect, it } from 'vitest';
import {
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
  it('accepts pages that leave something to read', () => {
    expect(validateTimerStartPage(0, 320)).toEqual([]);
    expect(validateTimerStartPage(319, 320)).toEqual([]);
  });

  it('rejects the last page and beyond', () => {
    expect(validateTimerStartPage(320, 320)).toEqual([
      expect.objectContaining({ field: 'startPage', code: 'start_page_not_below_total' }),
    ]);
  });
});
