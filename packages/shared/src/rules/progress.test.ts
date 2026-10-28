import { describe, expect, it } from 'vitest';
import {
  bookProgress,
  progressPercent,
  shouldOfferFinish,
  statusAfterSessionSaved,
} from './progress';

describe('bookProgress', () => {
  it('is 0 without sessions', () => {
    expect(bookProgress([])).toBe(0);
  });

  it('is the highest end page, ignoring running timers', () => {
    expect(
      bookProgress([{ endPage: 120 }, { endPage: 174 }, { endPage: 90 }, { endPage: null }]),
    ).toBe(174);
  });
});

describe('progressPercent', () => {
  it('rounds to a whole percent', () => {
    expect(progressPercent(174, 476)).toBe(37);
    expect(progressPercent(0, 476)).toBe(0);
    expect(progressPercent(476, 476)).toBe(100);
    expect(progressPercent(1, 200)).toBe(1); // 0.5 rounds up
  });
});

describe('status rules', () => {
  it('moves want_to_read to reading on the first session, and leaves others', () => {
    expect(statusAfterSessionSaved('want_to_read')).toBe('reading');
    expect(statusAfterSessionSaved('reading')).toBe('reading');
    expect(statusAfterSessionSaved('finished')).toBe('finished');
  });

  it('offers to finish when the last page is reached', () => {
    expect(shouldOfferFinish('reading', 476, 476)).toBe(true);
    expect(shouldOfferFinish('reading', 475, 476)).toBe(false);
    expect(shouldOfferFinish('finished', 476, 476)).toBe(false);
  });
});
