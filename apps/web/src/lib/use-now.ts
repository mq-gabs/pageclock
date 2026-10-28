'use client';

import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs` while `enabled`. */
export function useNow(enabled = true, intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(new Date());
    // Catch up right away after being disabled (e.g. a resumed timer), then keep ticking.
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [enabled, intervalMs]);
  return now;
}
