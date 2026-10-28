'use client';

import { useCallback, useRef } from 'react';

/**
 * A dialog with its own URL that opens without a server round trip: `open` pushes the URL with
 * `history.pushState` (Next keeps `usePathname` / `useSearchParams` in sync), so the page decides
 * from the URL whether the dialog shows. Back closes it, and a reload of that URL reopens it.
 *
 * `close` goes back when this page pushed the entry, and otherwise (the dialog URL was loaded
 * directly) replaces it with `closedHref` so Back doesn't reopen it.
 */
export function useLocalDialog(closedHref: string) {
  const pushedHere = useRef(false);
  const open = useCallback((href: string) => {
    pushedHere.current = true;
    window.history.pushState(null, '', href);
  }, []);
  const close = useCallback(() => {
    if (pushedHere.current) {
      pushedHere.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, '', closedHref);
    }
  }, [closedHref]);
  return { open, close };
}
