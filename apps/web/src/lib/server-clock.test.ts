import { afterEach, describe, expect, it, vi } from 'vitest';
import { noteServerDate, resetServerClock, serverClockOffsetMs, serverNow } from './server-clock';

afterEach(() => {
  resetServerClock();
  vi.useRealTimers();
});

describe('server clock', () => {
  it('uses the device clock until a response says otherwise', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-28T12:00:00.000Z') });
    expect(serverNow().toISOString()).toBe('2026-10-28T12:00:00.000Z');
  });

  it('corrects a device clock that runs 5 minutes fast', () => {
    const device = Date.parse('2026-10-28T12:05:00.000Z');
    vi.useFakeTimers({ now: device });
    // Sent and answered within 200 ms; the server said 12:00:00 (whole seconds).
    noteServerDate('Wed, 28 Oct 2026 12:00:00 GMT', device - 200, device);
    expect(serverNow().toISOString()).toBe('2026-10-28T12:00:00.600Z');
  });

  it('narrows the estimate with each response instead of jumping', () => {
    const device = Date.parse('2026-10-28T12:00:10.000Z');
    vi.useFakeTimers({ now: device });
    // The device clock is right. A response written at 12:00:09.900 says "12:00:09"; a slow
    // one (2 s) written at 12:00:12.100 says "12:00:12".
    noteServerDate('Wed, 28 Oct 2026 12:00:09 GMT', device - 200, device);
    noteServerDate('Wed, 28 Oct 2026 12:00:12 GMT', device + 100, device + 2100);
    // Bounds: −1000…+200 ms from the first, −100…+2900 from the second → −100…+200.
    expect(serverClockOffsetMs()).toBe(50);

    // A slow response alone would have moved the old estimate by ~1 s; it can't widen it now.
    noteServerDate('Wed, 28 Oct 2026 12:00:20 GMT', device + 9000, device + 12_000);
    expect(serverClockOffsetMs()).toBe(50);
  });

  it('starts over when the device clock is changed', () => {
    const device = Date.parse('2026-10-28T12:00:00.000Z');
    vi.useFakeTimers({ now: device });
    noteServerDate('Wed, 28 Oct 2026 12:00:00 GMT', device - 100, device);
    // The device clock now runs an hour fast.
    const moved = device + 3_600_000;
    noteServerDate('Wed, 28 Oct 2026 12:00:00 GMT', moved - 100, moved);
    expect(serverClockOffsetMs()).toBe(-3_600_000 + 550);
  });

  it('ignores a missing or unreadable header', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-28T12:00:00.000Z') });
    noteServerDate(null, 0, 0);
    noteServerDate('soon', 0, 0);
    expect(serverNow().toISOString()).toBe('2026-10-28T12:00:00.000Z');
  });
});
