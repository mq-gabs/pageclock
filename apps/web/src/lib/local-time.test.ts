import { describe, expect, it } from 'vitest';
import { fromLocalParts, rangeFromForm, toLocalParts } from './local-time';

const TZ = 'America/Fortaleza'; // UTC−3

describe('local time parts', () => {
  it('reads an instant as local date and time', () => {
    expect(toLocalParts('2026-10-28T02:30:00Z', TZ)).toEqual({ date: '2026-10-27', time: '23:30' });
  });

  it('turns local date and time into the right instant', () => {
    expect(fromLocalParts({ date: '2026-10-27', time: '23:30' }, TZ).toISOString()).toBe(
      '2026-10-28T02:30:00.000Z',
    );
  });

  it('round-trips', () => {
    const parts = { date: '2026-01-01', time: '00:05' };
    expect(toLocalParts(fromLocalParts(parts, TZ), TZ)).toEqual(parts);
  });
});

describe('rangeFromForm', () => {
  it('keeps both times on the chosen date', () => {
    const { startedAt, endedAt } = rangeFromForm(
      { date: '2026-10-27', startTime: '20:10', endTime: '20:51' },
      TZ,
    );
    expect(startedAt.toISOString()).toBe('2026-10-27T23:10:00.000Z');
    expect(endedAt.toISOString()).toBe('2026-10-27T23:51:00.000Z');
  });

  it('moves the end to the next day when the session crosses midnight', () => {
    const { startedAt, endedAt } = rangeFromForm(
      { date: '2026-10-27', startTime: '23:30', endTime: '00:15' },
      TZ,
    );
    expect(startedAt.toISOString()).toBe('2026-10-28T02:30:00.000Z');
    expect(endedAt.toISOString()).toBe('2026-10-28T03:15:00.000Z');
  });
});
