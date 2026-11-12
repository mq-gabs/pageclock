'use client';

import { useEffect, useState } from 'react';

const deviceNow = () => new Date();

/**
 * The current time, refreshed every `intervalMs` while `enabled`. Timer displays pass
 * `serverNow`, the clock timer clicks are stamped with, so pausing freezes the second shown.
 */
export function useNow(enabled = true, intervalMs = 1000, clock: () => Date = deviceNow): Date {
  const [now, setNow] = useState(clock);
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(clock());
    // Catch up right away after being disabled (e.g. a resumed timer), then keep ticking.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [enabled, intervalMs, clock]);
  return now;
}
