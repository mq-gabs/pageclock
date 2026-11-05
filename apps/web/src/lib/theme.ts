'use client';

import { useSyncExternalStore } from 'react';
import { parseThemePreference, themeStorageKey, type ThemePreference } from './theme-script';

const listeners = new Set<() => void>();

function read(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(themeStorageKey));
  } catch {
    return 'system';
  }
}

function apply(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', preference);
}

let memory: ThemePreference | undefined;

function getPreference(): ThemePreference {
  if (memory === undefined) memory = read();
  return memory;
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(themeStorageKey);
    else window.localStorage.setItem(themeStorageKey, preference);
  } catch {
    // Storage blocked (private mode): the theme still applies to this page.
  }
  memory = preference;
  apply(preference);
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // A theme picked in another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== themeStorageKey && event.key !== null) return;
    memory = read();
    apply(memory);
    onChange();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** The saved choice; `undefined` on the server and during hydration. */
export function useThemePreference(): ThemePreference | undefined {
  return useSyncExternalStore(subscribe, getPreference, () => undefined);
}
