import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookWithProgress, Timer, TimerOp } from '@reading-tracker/shared';
import {
  classifyFailure,
  createTimerQueue,
  slowRetryAfterFailures,
  retryDelayMs,
  timerQueueKey,
  type QueueStorage,
  type TimerQueue,
} from './timer-queue';
import { ApiRequestError } from './api';

const userId = 'user-1';
const sessionId = '22222222-2222-4222-8222-222222222222';
const otherSession = '33333333-3333-4333-8333-333333333333';
const at = '2026-10-27T23:10:00.000Z';

const book: BookWithProgress = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Piranesi',
  author: 'Susanna Clarke',
  totalPages: 272,
  status: 'reading',
  finishedAt: null,
  createdAt: at,
  updatedAt: at,
  progress: 40,
  percent: 15,
};

const timer = (overrides: Partial<Timer['session']> = {}): Timer => ({
  session: {
    id: sessionId,
    bookId: book.id,
    startedAt: at,
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    startPage: 41,
    endPage: null,
    source: 'timer',
    createdAt: at,
    updatedAt: at,
    metrics: null,
    ...overrides,
  },
  book,
  previous: null,
});

let n = 0;
const opId = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const start = (id = sessionId): TimerOp => ({
  kind: 'start',
  opId: opId(),
  sessionId: id,
  at,
  book,
});
const pause = (id = sessionId): TimerOp => ({ kind: 'pause', opId: opId(), sessionId: id, at });
const resume = (id = sessionId): TimerOp => ({ kind: 'resume', opId: opId(), sessionId: id, at });
const discard = (id = sessionId): TimerOp => ({ kind: 'discard', opId: opId(), sessionId: id });

function memoryStorage(): QueueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

type Call = { method: string; url: string; body: unknown };
type Handler = (call: Call, signal: AbortSignal | undefined) => Response | Promise<Response>;

let calls: Call[];
let handler: Handler;
const ok = (body: unknown) => () => Response.json(body);
const offline: Handler = () => {
  throw new TypeError('Failed to fetch');
};

beforeEach(() => {
  vi.useFakeTimers();
  calls = [];
  handler = ok({ timer: timer() });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit) => {
      const call = {
        method: init.method ?? 'GET',
        url,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      return handler(call, init.signal ?? undefined);
    }),
  );
});

const queues: TimerQueue[] = [];
afterEach(() => {
  for (const queue of queues.splice(0)) queue.dispose();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function makeQueue(storage = memoryStorage()) {
  const queue = createTimerQueue({ storage: () => storage, lock: null });
  queues.push(queue);
  queue.setUser(userId);
  return queue;
}

/** Lets pending promises (fetch, JSON parsing) settle without moving the clock. */
const settle = () => vi.advanceTimersByTimeAsync(0);

describe('retryDelayMs', () => {
  it('waits 1, 2, 4, 5, 5… seconds, then 30 from the 10th failure', () => {
    const delays = Array.from({ length: 11 }, (_, i) => retryDelayMs(i + 1) / 1000);
    expect(delays).toEqual([1, 2, 4, 5, 5, 5, 5, 5, 5, 30, 30]);
    // The 10th failure comes about 40 s after the first.
    expect(delays.slice(0, 9).reduce((a, b) => a + b)).toBe(37);
  });
});

describe('classifyFailure', () => {
  it('retries network errors, 5xx, 429 and 408; stops on 401; drops other 4xx', () => {
    const error = (status: number) => new ApiRequestError(status, 'x', 'x');
    expect([0, 500, 503, 429, 408].map((s) => classifyFailure(error(s)))).toEqual(
      Array(5).fill('retry'),
    );
    expect(classifyFailure(error(401))).toBe('signed_out');
    expect([400, 404, 409].map((s) => classifyFailure(error(s)))).toEqual(
      Array(3).fill('rejected'),
    );
    expect(classifyFailure(new Error('bad answer'))).toBe('rejected');
  });
});

describe('createTimerQueue', () => {
  it('sends actions one at a time, in order, with the API bodies', async () => {
    let release: (() => void) | undefined;
    handler = (call) =>
      call.url === '/api/timer/start'
        ? new Promise((resolve) => (release = () => resolve(Response.json({ timer: timer() }))))
        : Response.json({ timer: timer() });
    const queue = makeQueue();
    const ops = [start(), pause(), resume()];
    for (const op of ops) queue.enqueue(op);
    await settle();
    expect(calls).toHaveLength(1); // the pause waits for the start's answer

    release!();
    await settle();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/timer/start',
      'POST /api/timer/pause',
      'POST /api/timer/resume',
    ]);
    expect(calls[0]!.body).toEqual({
      opId: ops[0]!.opId,
      sessionId,
      bookId: book.id,
      startedAt: at,
    });
    expect(calls[1]!.body).toEqual({ opId: ops[1]!.opId, sessionId, at });
    expect(queue.getState()).toMatchObject({ ops: [], failures: 0, server: { timer: timer() } });
  });

  it('keeps the server’s answer after every success, so the screen never loses an action', async () => {
    handler = (call) =>
      Response.json({
        timer: timer(call.url.endsWith('pause') ? { pausedAt: at } : {}),
      });
    const queue = makeQueue();
    const seen: (string | null | undefined)[] = [];
    queue.onServer((server) => seen.push(server.timer?.session.pausedAt));
    queue.enqueue(start());
    queue.enqueue(pause());
    await settle();
    expect(seen).toEqual([null, at]); // after the start, then after the pause
    expect(queue.getState().server?.timer?.session.pausedAt).toBe(at);
  });

  it('retries after 1, 2, 4, 5, 5… seconds and reaches 10 failures in about 40 s', async () => {
    handler = offline;
    const queue = makeQueue();
    queue.enqueue(pause());
    await settle();
    expect(queue.getState().failures).toBe(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(4000);
    expect(calls).toHaveLength(4);
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(5);

    await vi.advanceTimersByTimeAsync(5000 * 5 - 1);
    expect(queue.getState().failures).toBe(slowRetryAfterFailures - 1);
    await vi.advanceTimersByTimeAsync(1);
    expect(queue.getState().failures).toBe(slowRetryAfterFailures); // 37 s after the first

    await vi.advanceTimersByTimeAsync(29_999);
    expect(calls).toHaveLength(10);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(11);
    expect(queue.getState().ops).toHaveLength(1);
  });

  it('resets the failure count on the next success', async () => {
    handler = offline;
    const queue = makeQueue();
    queue.enqueue(pause());
    await vi.advanceTimersByTimeAsync(37_000);
    expect(queue.getState().failures).toBe(10);

    handler = ok({ timer: timer({ pausedAt: at }) });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(queue.getState()).toMatchObject({ ops: [], failures: 0 });
  });

  it('counts a request without an answer in 10 s as a failure', async () => {
    handler = (_call, signal) =>
      new Promise((_resolve, reject) =>
        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))),
      );
    const queue = makeQueue();
    queue.enqueue(pause());
    await vi.advanceTimersByTimeAsync(9_999);
    expect(queue.getState().failures).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(queue.getState().failures).toBe(1);
  });

  it('retries at once on retryNow()', async () => {
    handler = offline;
    const queue = makeQueue();
    queue.enqueue(pause());
    await vi.advanceTimersByTimeAsync(7_000);
    expect(calls).toHaveLength(4); // now waiting 5 s

    handler = ok({ timer: timer({ pausedAt: at }) });
    queue.retryNow();
    await settle();
    expect(calls).toHaveLength(5);
    expect(queue.getState().ops).toEqual([]);
  });

  it('drops a refused action and the later actions of its session', async () => {
    handler = (call) =>
      call.url === '/api/timer/pause'
        ? Response.json(
            { error: { code: 'no_timer', message: 'No timer is running' } },
            { status: 404 },
          )
        : Response.json({ timer: null });
    const queue = makeQueue();
    const rejected: [unknown, TimerOp][] = [];
    queue.onRejected((error, op) => rejected.push([error, op]));
    const refused = pause();
    queue.enqueue(refused);
    queue.enqueue(resume());
    queue.enqueue(start(otherSession));
    await settle();

    expect(calls.map((c) => c.url)).toEqual(['/api/timer/pause', '/api/timer/start']);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]![0]).toMatchObject({ status: 404, message: 'No timer is running' });
    expect(rejected[0]![1]).toBe(refused);
    expect(queue.getState().ops).toEqual([]);
  });

  it('stops on a 401 and keeps the list until the user signs in again', async () => {
    handler = () =>
      Response.json({ error: { code: 'unauthorized', message: 'Sign in' } }, { status: 401 });
    const queue = makeQueue();
    queue.enqueue(pause());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls).toHaveLength(1);
    expect(queue.getState().ops).toHaveLength(1);

    handler = ok({ timer: timer({ pausedAt: at }) });
    queue.setUser(userId);
    await settle();
    expect(calls).toHaveLength(2);
    expect(queue.getState().ops).toEqual([]);
  });

  it('keeps the list in storage per user, and a reload resumes it', async () => {
    handler = offline;
    const storage = memoryStorage();
    const first = makeQueue(storage);
    const op = pause();
    first.enqueue(op);
    await settle();
    expect(JSON.parse(storage.data.get(timerQueueKey(userId))!).ops).toEqual([op]);
    first.dispose();

    handler = ok({ timer: timer({ pausedAt: at }) });
    const reloaded = makeQueue(storage);
    expect(reloaded.getState().ops).toEqual([op]);
    await settle();
    expect(calls.at(-1)?.body).toMatchObject({ opId: op.opId });
    expect(reloaded.getState().ops).toEqual([]);

    reloaded.setUser('user-2');
    expect(reloaded.getState().ops).toEqual([]);
  });

  it('keeps actions made before the user is known and sends them once it is', async () => {
    const queue = createTimerQueue({ storage: () => memoryStorage(), lock: null });
    queues.push(queue);
    const op = start();
    queue.enqueue(op);
    expect(queue.getState().ops).toEqual([op]);
    await settle();
    expect(calls).toHaveLength(0);

    queue.setUser(userId);
    await settle();
    expect(calls[0]?.body).toMatchObject({ opId: op.opId });
    expect(queue.getState().ops).toEqual([]);
  });

  it('ignores a damaged stored list', () => {
    const storage = memoryStorage();
    storage.data.set(timerQueueKey(userId), '{"ops":[{"kind":"nope"}]}');
    expect(makeQueue(storage).getState().ops).toEqual([]);
  });

  it('works in memory when storage throws', async () => {
    handler = offline;
    const broken: QueueStorage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const queue = createTimerQueue({ storage: () => broken, lock: null });
    queues.push(queue);
    queue.setUser(userId);
    queue.enqueue(pause());
    await settle();
    expect(queue.getState()).toMatchObject({ failures: 1, ops: [expect.anything()] });
  });

  it('discards a Start that wasn’t sent yet without any request', async () => {
    handler = offline;
    const queue = makeQueue();
    queue.enqueue(pause(otherSession)); // keeps failing at the head, so the start waits
    queue.enqueue(start());
    queue.enqueue(pause());
    await settle();
    queue.enqueue(discard());
    expect(queue.getState().ops.map((op) => op.sessionId)).toEqual([otherSession]);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls.every((c) => c.method !== 'DELETE')).toBe(true);
  });

  it('sends a Discard once the Start has reached the API, and a 404 counts as done', async () => {
    const queue = makeQueue();
    queue.enqueue(start());
    await settle();
    handler = () =>
      Response.json({ error: { code: 'not_found', message: 'Gone' } }, { status: 404 });
    const rejected = vi.fn();
    queue.onRejected(rejected);
    queue.enqueue(discard());
    await settle();
    expect(calls.at(-1)).toMatchObject({
      method: 'DELETE',
      url: `/api/reading-sessions/${sessionId}`,
    });
    expect(rejected).not.toHaveBeenCalled();
    expect(queue.getState()).toMatchObject({ ops: [], server: { timer: null } });
  });

  it('flush() resolves once the list is empty', async () => {
    handler = offline;
    const queue = makeQueue();
    await expect(queue.flush()).resolves.toBeUndefined();

    queue.enqueue(pause());
    let flushed = false;
    void queue.flush().then(() => (flushed = true));
    await vi.advanceTimersByTimeAsync(3_000);
    expect(flushed).toBe(false);

    handler = ok({ timer: timer({ pausedAt: at }) });
    await vi.advanceTimersByTimeAsync(4_000);
    expect(flushed).toBe(true);
  });

  it('fails every send while simulating offline', async () => {
    const queue = makeQueue();
    queue.setSimulateOffline(true);
    queue.enqueue(pause());
    await vi.advanceTimersByTimeAsync(2_999); // failures at 0 s and 1 s
    expect(calls).toHaveLength(0);
    expect(queue.getState().failures).toBe(2);

    queue.setSimulateOffline(false);
    await settle();
    expect(queue.getState()).toMatchObject({ ops: [], failures: 0 });
  });

  it('clear() forgets the waiting actions', async () => {
    handler = offline;
    const storage = memoryStorage();
    const queue = makeQueue(storage);
    queue.enqueue(pause());
    await settle();
    queue.clear();
    expect(queue.getState().ops).toEqual([]);
    expect(storage.data.has(timerQueueKey(userId))).toBe(false);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toHaveLength(1);
  });
});
