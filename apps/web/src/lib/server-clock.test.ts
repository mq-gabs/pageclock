import { afterEach, describe, expect, it, vi } from 'vitest';
import { noteServerDate, resetServerClock, serverNow } from './server-clock';

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

  it('ignores a missing or unreadable header', () => {
    vi.useFakeTimers({ now: Date.parse('2026-10-28T12:00:00.000Z') });
    noteServerDate(null, 0, 0);
    noteServerDate('soon', 0, 0);
    expect(serverNow().toISOString()).toBe('2026-10-28T12:00:00.000Z');
  });
});
