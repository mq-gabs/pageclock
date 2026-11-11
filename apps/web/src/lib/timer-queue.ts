import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import {
  timerOpSchema,
  timerResponseSchema,
  type TimerOp,
  type TimerResponse,
} from '@reading-tracker/shared';
import { api, apiNoContent, ApiRequestError } from './api';

/**
 * The timer queue (rule 5): timer actions are applied on screen at once and kept on the
 * device (memory + localStorage, per user) until the API confirms them. They are sent one at
 * a time, in order, and retried; the API recognises a retry by its `opId`.
 */

/** After this many failures in a row, the app shows the `ConnectionBanner`. */
export const failureBannerThreshold = 3;
/** From this many failures in a row, retries slow down to every 30 s. */
export const slowRetryAfterFailures = 10;
export const requestTimeoutMs = 10_000;
const lockName = 'pageclock-timer-queue';

/** Seconds to wait after the nth failure in a row: 1, 2, 4, 5, 5, …, then 30 from the 10th. */
export function retryDelayMs(failures: number): number {
  if (failures >= slowRetryAfterFailures) return 30_000;
  return Math.min(2 ** (failures - 1), 5) * 1000;
}

const stateSchema = z.object({
  ops: z.array(timerOpSchema),
  failures: z.int().min(0),
  /** The action being sent; Discard can't drop a Start that may already have arrived. */
  sending: z.string().nullable(),
  /** The API's latest timer answer (null before any), shared so other tabs show it too. */
  server: timerResponseSchema.nullable(),
  /** Bumped by `retryNow()`, so the tab that sends wakes up even if another tab asked. */
  nudge: z.int(),
});
export type TimerQueueState = z.infer<typeof stateSchema>;

const emptyState: TimerQueueState = { ops: [], failures: 0, sending: null, server: null, nudge: 0 };

/** Sends one action; resolves with the API's timer (null after a Discard). */
export type TimerOpRequest = (op: TimerOp, signal: AbortSignal) => Promise<TimerResponse>;

/** The routes of rule 5, with the bodies the API expects. */
export const sendTimerOp: TimerOpRequest = async (op, signal) => {
  const { opId, sessionId } = op;
  const options = { signal };
  switch (op.kind) {
    case 'start':
      return api(
        'POST',
        '/api/timer/start',
        timerResponseSchema,
        { opId, sessionId, bookId: op.book.id, startedAt: op.at, startPage: op.startPage },
        options,
      );
    case 'pause':
    case 'resume':
      return api(
        'POST',
        `/api/timer/${op.kind}`,
        timerResponseSchema,
        { opId, sessionId, at: op.at },
        options,
      );
    case 'startPage':
      return api(
        'PATCH',
        '/api/timer',
        timerResponseSchema,
        { opId, sessionId, startPage: op.startPage },
        options,
      );
    case 'discard':
      try {
        await apiNoContent('DELETE', `/api/reading-sessions/${sessionId}`, undefined, options);
      } catch (error) {
        // Already gone: an earlier try arrived but its answer didn't.
        if (!(error instanceof ApiRequestError && error.status === 404)) throw error;
      }
      return { timer: null };
  }
};

type Outcome = 'retry' | 'signed_out' | 'rejected';

/** What the queue does with a failed send (see the spec's table). */
export function classifyFailure(error: unknown): Outcome {
  if (!(error instanceof ApiRequestError)) return 'rejected'; // e.g. an unexpected answer
  const { status } = error;
  if (status === 0 || status >= 500 || status === 429 || status === 408) return 'retry';
  if (status === 401) return 'signed_out';
  return 'rejected';
}

/** Storage that may be missing or throw (private mode, blocked site data). */
export type QueueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

type LockRequest = (name: string, callback: () => Promise<void>) => Promise<void>;

export interface TimerQueueOptions {
  storage?: () => QueueStorage | null;
  request?: TimerOpRequest;
  /** `navigator.locks.request`, so only one tab sends; without it this tab just sends. */
  lock?: LockRequest | null;
  timeoutMs?: number;
}

/** An action the API refused: it and the session's later actions were dropped. */
export type RejectedListener = (error: unknown, op: TimerOp) => void;
/** A new timer answer from the API, received by this tab or by the tab that sends. */
export type ServerListener = (server: TimerResponse) => void;

const browserStorage = (): QueueStorage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

const browserLock = (): LockRequest | null => {
  if (typeof navigator === 'undefined' || !navigator.locks) return null;
  return (name, callback) => navigator.locks.request(name, callback);
};

export const timerQueueKey = (userId: string) => `pageclock.timer-queue.${userId}`;

export function createTimerQueue(options: TimerQueueOptions = {}) {
  const storage = options.storage ?? browserStorage;
  const request = options.request ?? sendTimerOp;
  const lock = options.lock === undefined ? browserLock() : options.lock;
  const timeoutMs = options.timeoutMs ?? requestTimeoutMs;

  let userId: string | null = null;
  let state: TimerQueueState = emptyState;
  /** The raw stored value `state` was parsed from, to skip parsing unchanged data. */
  let raw: string | null = null;
  /** A 401: stop sending until the user signs in again. */
  let blocked = false;
  let running = false;
  let simulateOffline = false;
  let wake: (() => void) | null = null;
  const listeners = new Set<() => void>();
  const rejectedListeners = new Set<RejectedListener>();
  const serverListeners = new Set<ServerListener>();
  let flushWaiters: (() => void)[] = [];

  function notify() {
    for (const listener of listeners) listener();
    if (state.ops.length === 0 && flushWaiters.length > 0) {
      const waiters = flushWaiters;
      flushWaiters = [];
      for (const resolve of waiters) resolve();
    }
  }

  /** Re-reads the stored state; memory is the fallback when storage is unavailable. */
  function load(): TimerQueueState {
    if (!userId) return state;
    let stored: string | null;
    try {
      stored = storage()?.getItem(timerQueueKey(userId)) ?? null;
    } catch {
      return state;
    }
    if (stored === raw || stored === null) return state;
    raw = stored;
    try {
      const parsed = stateSchema.safeParse(JSON.parse(stored));
      if (parsed.success) state = parsed.data;
    } catch {
      // Not JSON: keep what's in memory.
    }
    return state;
  }

  function save(next: TimerQueueState) {
    state = next;
    if (userId) {
      try {
        const value = JSON.stringify(next);
        storage()?.setItem(timerQueueKey(userId), value);
        raw = value;
      } catch {
        // Storage full or blocked: the list still lives in memory for this page.
      }
    }
    notify();
  }

  const update = (change: (current: TimerQueueState) => TimerQueueState) => save(change(load()));

  const dropSession = (ops: readonly TimerOp[], sessionId: string) =>
    ops.filter((op) => op.sessionId !== sessionId);

  function sleep(ms: number) {
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(done, ms);
      function done() {
        clearTimeout(timeout);
        wake = null;
        resolve();
      }
      wake = done;
    });
  }

  async function sendWithTimeout(op: TimerOp): Promise<TimerResponse> {
    if (simulateOffline) {
      throw new ApiRequestError(0, 'network_error', 'Offline (simulated)');
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await request(op, controller.signal);
    } finally {
      clearTimeout(timeout);
    }
  }

  /** Sends the head of the list until it's empty, signed out, or this user is gone. */
  async function drain() {
    const owner = userId;
    while (userId === owner && !blocked) {
      const op = load().ops[0];
      if (!op) break;
      update((s) => ({ ...s, sending: op.opId }));
      try {
        const server = await sendWithTimeout(op);
        if (userId !== owner) break;
        update((s) => ({
          ...s,
          ops: s.ops.filter((o) => o.opId !== op.opId),
          failures: 0,
          sending: null,
          server,
        }));
        for (const listener of serverListeners) listener(server);
      } catch (error) {
        if (userId !== owner) break;
        const outcome = classifyFailure(error);
        if (outcome === 'signed_out') {
          blocked = true;
          update((s) => ({ ...s, sending: null }));
        } else if (outcome === 'rejected') {
          // It can't succeed (e.g. the timer was stopped on another device): later actions of
          // the same session can't either.
          update((s) => ({
            ...s,
            ops: dropSession(
              s.ops.filter((o) => o.opId !== op.opId),
              op.sessionId,
            ),
            failures: 0,
            sending: null,
          }));
          for (const listener of rejectedListeners) listener(error, op);
        } else {
          let failures = 0;
          update((s) => {
            failures = s.failures + 1;
            return { ...s, failures, sending: null };
          });
          await sleep(retryDelayMs(failures));
        }
      }
    }
  }

  function kick() {
    if (running || blocked || !userId || load().ops.length === 0) return;
    running = true;
    const run = lock ? lock(lockName, drain) : drain();
    void run
      .catch(() => undefined)
      .finally(() => {
        running = false;
        // Actions added by another tab while this one waited for the lock.
        if (!blocked && userId && load().ops.length > 0) kick();
      });
  }

  function onStorage(event: StorageEvent) {
    if (!userId || (event.key !== timerQueueKey(userId) && event.key !== null)) return;
    const { nudge, server } = state;
    load();
    notify();
    if (state.nudge !== nudge) wake?.();
    if (state.server && JSON.stringify(state.server) !== JSON.stringify(server)) {
      for (const listener of serverListeners) listener(state.server);
    }
    kick();
  }

  function onOnline() {
    wake?.();
    kick();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', onOnline);
  }

  return {
    /** Switches to a user's list (null when signed out) and starts sending it. */
    setUser(next: string | null) {
      if (next === userId && !blocked) return;
      if (next !== userId) {
        // Taps made before the user was known (the app is signed in, `/api/me` hadn't
        // answered yet) belong to the user who arrives now.
        const early = userId === null ? state.ops : [];
        userId = next;
        state = emptyState;
        raw = null;
        wake?.();
        if (next && early.length > 0) update((s) => ({ ...s, ops: [...s.ops, ...early] }));
      }
      blocked = false;
      load();
      notify();
      kick();
    },

    /** Adds an action and starts sending. A Discard of a Start not sent yet stays local. */
    enqueue(op: TimerOp) {
      if (!userId) {
        // Kept in memory until `setUser()`, which adds it to that user's list.
        state = { ...state, ops: [...state.ops, op] };
        notify();
        return;
      }
      if (op.kind === 'discard') {
        const current = load();
        const start = current.ops.find((o) => o.kind === 'start' && o.sessionId === op.sessionId);
        if (start && current.sending !== start.opId) {
          save({ ...current, ops: dropSession(current.ops, op.sessionId) });
          return;
        }
      }
      update((s) => ({ ...s, ops: [...s.ops, op] }));
      kick();
    },

    /** Resolves once every waiting action has been sent or dropped. */
    flush(): Promise<void> {
      if (load().ops.length === 0) return Promise.resolve();
      return new Promise((resolve) => flushWaiters.push(resolve));
    },

    /** Retries now instead of waiting for the backoff, in whichever tab sends. */
    retryNow() {
      if (!userId) return;
      update((s) => ({ ...s, nudge: s.nudge + 1 }));
      wake?.();
      kick();
    },

    /** Forgets the user's waiting actions (sign-out, decision 2). */
    clear() {
      if (userId) {
        try {
          storage()?.removeItem(timerQueueKey(userId));
        } catch {
          // Nothing stored.
        }
      }
      state = emptyState;
      raw = null;
      wake?.();
      notify();
    },

    /** Dev page: every send fails like a network error. */
    setSimulateOffline(on: boolean) {
      simulateOffline = on;
      if (!on) {
        wake?.();
        kick();
      }
    },
    isSimulatingOffline: () => simulateOffline,

    getState: (): TimerQueueState => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    onRejected(listener: RejectedListener) {
      rejectedListeners.add(listener);
      return () => rejectedListeners.delete(listener);
    },
    /** Not called for the stored answer on load: it may be stale, the cache refetches. */
    onServer(listener: ServerListener) {
      serverListeners.add(listener);
      return () => serverListeners.delete(listener);
    },

    /** For tests: stop listening to window events. */
    dispose() {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('online', onOnline);
      }
      wake?.();
      userId = null;
    },
  };
}

export type TimerQueue = ReturnType<typeof createTimerQueue>;

/** The app's queue; `TimerQueueSync` connects it to the signed-in user and the query cache. */
export const timerQueue = createTimerQueue();

const serverSnapshot = emptyState;

/** The queue's state for the UI: waiting actions and failures in a row. */
export function useTimerQueue() {
  const state = useSyncExternalStore(
    timerQueue.subscribe,
    timerQueue.getState,
    () => serverSnapshot,
  );
  return { pending: state.ops.length, failures: state.failures, ops: state.ops };
}
