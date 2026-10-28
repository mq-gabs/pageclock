'use client';

import { useCallback, useEffect, useId, useSyncExternalStore, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** Which links or router calls are waiting for the next route; the top bar shows while any are. */
const pending = new Set<string>();
const listeners = new Set<() => void>();

function setPending(key: string, value: boolean) {
  if (value === pending.has(key)) return;
  if (value) pending.add(key);
  else pending.delete(key);
  for (const listener of listeners) listener();
}

export function useNavigationPending(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    () => pending.size > 0,
    () => false,
  );
}

/** Reports a pending state under a key that is cleared on unmount. */
export function useReportPending(isPending: boolean) {
  const key = useId();
  useEffect(() => {
    setPending(key, isPending);
  }, [key, isPending]);
  useEffect(() => () => setPending(key, false), [key]);
}

/**
 * `router.push` / `replace` that show the navigation bar until the new route has rendered
 * (a transition stays pending until then).
 */
export function useAppRouter() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  useReportPending(isPending);
  const push = useCallback((href: string) => startTransition(() => router.push(href)), [router]);
  const replace = useCallback(
    (href: string) => startTransition(() => router.replace(href)),
    [router],
  );
  return { push, replace };
}
