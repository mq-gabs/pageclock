'use client';

import { useSyncExternalStore } from 'react';

export type ToastVariant = 'success' | 'warning' | 'error';

/**
 * open → leaving (slides out to the right) → collapsing (its slot shrinks so the toasts
 * above move down) → removed.
 */
export type ToastPhase = 'open' | 'leaving' | 'collapsing';

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  title?: string;
  phase: ToastPhase;
}

export interface ToastOptions {
  title?: string;
  /** How long the toast stays before sliding out, in ms. */
  duration?: number;
}

export const defaultToastDurationMs = 5000;
/** Keep in sync with the toast animations in globals.css. */
export const toastSlideOutMs = 200;
export const toastCollapseMs = 150;

export function createToastStore() {
  let toasts: readonly Toast[] = [];
  let nextId = 1;
  const listeners = new Set<() => void>();
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  // Every change replaces the array, so useSyncExternalStore sees a new snapshot.
  function set(next: readonly Toast[]) {
    toasts = next;
    for (const listener of listeners) listener();
  }

  function schedule(id: number, ms: number, run: () => void) {
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(run, ms));
  }

  function setPhase(id: number, phase: ToastPhase) {
    set(toasts.map((t) => (t.id === id ? { ...t, phase } : t)));
  }

  function dismiss(id: number) {
    const current = toasts.find((t) => t.id === id);
    if (!current || current.phase !== 'open') return;
    setPhase(id, 'leaving');
    schedule(id, toastSlideOutMs, () => {
      setPhase(id, 'collapsing');
      schedule(id, toastCollapseMs, () => {
        timers.delete(id);
        set(toasts.filter((t) => t.id !== id));
      });
    });
  }

  function show(variant: ToastVariant, message: string, options: ToastOptions = {}) {
    const id = nextId++;
    set([...toasts, { id, variant, message, title: options.title, phase: 'open' }]);
    schedule(id, options.duration ?? defaultToastDurationMs, () => dismiss(id));
    return id;
  }

  return {
    success: (message: string, options?: ToastOptions) => show('success', message, options),
    warning: (message: string, options?: ToastOptions) => show('warning', message, options),
    error: (message: string, options?: ToastOptions) => show('error', message, options),
    dismiss,
    dismissAll: () => {
      for (const t of toasts) dismiss(t.id);
    },
    getSnapshot: () => toasts,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const store = createToastStore();
const noToasts: readonly Toast[] = [];

/**
 * Show a toast from anywhere, including mutation callbacks after the caller unmounted:
 * `toast.success('Session saved')`. The `<Toaster />` in the root layout renders them.
 */
export const toast = {
  success: store.success,
  warning: store.warning,
  error: store.error,
  dismiss: store.dismiss,
  dismissAll: store.dismissAll,
};

export function useToasts(): readonly Toast[] {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => noToasts);
}
