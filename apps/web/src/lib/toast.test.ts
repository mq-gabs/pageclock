import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createToastStore,
  defaultToastDurationMs,
  toastCollapseMs,
  toastSlideOutMs,
} from './toast';

describe('toast store', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('adds toasts in order, newest last, with their variant', () => {
    const store = createToastStore();
    store.success('Saved');
    store.warning('Check the pages', { title: 'Heads up' });
    store.error('Failed');

    expect(store.getSnapshot().map((t) => [t.variant, t.message, t.phase])).toEqual([
      ['success', 'Saved', 'open'],
      ['warning', 'Check the pages', 'open'],
      ['error', 'Failed', 'open'],
    ]);
    expect(store.getSnapshot()[1]?.title).toBe('Heads up');
  });

  it('slides out after the duration, collapses, then removes the toast', () => {
    const store = createToastStore();
    store.success('Saved');

    vi.advanceTimersByTime(defaultToastDurationMs - 1);
    expect(store.getSnapshot()[0]?.phase).toBe('open');

    vi.advanceTimersByTime(1);
    expect(store.getSnapshot()[0]?.phase).toBe('leaving');

    vi.advanceTimersByTime(toastSlideOutMs);
    expect(store.getSnapshot()[0]?.phase).toBe('collapsing');

    vi.advanceTimersByTime(toastCollapseMs);
    expect(store.getSnapshot()).toEqual([]);
  });

  it('honours a custom duration', () => {
    const store = createToastStore();
    store.error('Failed', { duration: 1000 });
    vi.advanceTimersByTime(1000);
    expect(store.getSnapshot()[0]?.phase).toBe('leaving');
  });

  it('dismisses early and ignores a second dismiss or the original timeout', () => {
    const store = createToastStore();
    const id = store.success('Saved');
    store.dismiss(id);
    store.dismiss(id);
    expect(store.getSnapshot()[0]?.phase).toBe('leaving');

    vi.advanceTimersByTime(toastSlideOutMs + toastCollapseMs);
    expect(store.getSnapshot()).toEqual([]);
    vi.advanceTimersByTime(defaultToastDurationMs);
    expect(store.getSnapshot()).toEqual([]);
  });

  it('removing one toast keeps the others', () => {
    const store = createToastStore();
    const first = store.success('One');
    store.success('Two');
    store.dismiss(first);
    vi.advanceTimersByTime(toastSlideOutMs + toastCollapseMs);
    expect(store.getSnapshot().map((t) => t.message)).toEqual(['Two']);
  });

  it('dismissAll slides every toast out', () => {
    const store = createToastStore();
    store.success('One');
    store.error('Two');
    store.dismissAll();
    expect(store.getSnapshot().every((t) => t.phase === 'leaving')).toBe(true);
  });

  it('notifies subscribers with a new snapshot until they unsubscribe', () => {
    const store = createToastStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getSnapshot();
    store.success('Saved');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).not.toBe(before);

    unsubscribe();
    store.success('Again');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
