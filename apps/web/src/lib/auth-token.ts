'use client';

import { useSyncExternalStore } from 'react';

/**
 * The bearer token lives in localStorage, so it survives reloads and is shared by tabs.
 * Every API request sends it (`lib/api.ts`); a 401 clears it, which sends the app to sign in.
 */
const storageKey = 'pageclock.token';
const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function write(token: string | null) {
  try {
    if (token) window.localStorage.setItem(storageKey, token);
    else window.localStorage.removeItem(storageKey);
  } catch {
    // Storage blocked (private mode): the token still lives for this page in `memory`.
  }
  memory = token;
  for (const listener of listeners) listener();
}

let memory: string | null | undefined;

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (memory === undefined) memory = read();
  return memory;
}

export const setToken = (token: string) => write(token);
export const clearToken = () => write(null);

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Signing in or out in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    memory = read();
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The current token: `undefined` while it can't be known yet (on the server and during
 * hydration), then the token or `null` when signed out.
 */
export function useAuthToken(): string | null | undefined {
  return useSyncExternalStore(subscribe, getToken, () => undefined);
}
