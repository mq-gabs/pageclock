import { describe, expect, it } from 'vitest';
import type { BookWithProgress } from '@reading-tracker/shared';
import {
  formatBookMeta,
  formatClock,
  formatCount,
  formatDateKey,
  formatDelta,
  formatKeyRange,
  formatMinutesDelta,
  formatDayLabel,
  formatDuration,
  formatRelativeDay,
  formatSessionDuration,
  formatShortDate,
  formatSpeed,
  formatTime,
} from './format';

const TZ = 'America/Fortaleza';

describe('formatDuration', () => {
  it('uses minutes under an hour and hours with minutes above', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(41.4)).toBe('41 min');
    expect(formatDuration(59.6)).toBe('1h');
    expect(formatDuration(224)).toBe('3h 44m');
  });
});

describe('formatSpeed', () => {
  it('rounds pages per hour', () => {
    expect(formatSpeed(37.6)).toBe('38 p/h');
    expect(formatSpeed(null)).toBe('—');
  });
});

describe('dates', () => {
  it('formats in the app time zone', () => {
    expect(formatShortDate('2026-10-13T02:00:00Z', TZ)).toBe('Oct 12'); // 23:00 local
  });

  it('labels a session by its local start', () => {
    expect(formatDayLabel('2026-10-28T02:30:00Z', TZ)).toBe('Tue, Oct 27');
    expect(formatTime('2026-10-28T02:30:00Z', TZ)).toBe('23:30');
  });

  it('describes days relative to now, by local date', () => {
    const now = new Date('2026-10-28T15:00:00Z');
    expect(formatRelativeDay('2026-10-28T03:30:00Z', now, TZ)).toBe('today');
    expect(formatRelativeDay('2026-10-28T02:30:00Z', now, TZ)).toBe('yesterday'); // 23:30 Oct 27 local
    expect(formatRelativeDay('2026-10-25T12:00:00Z', now, TZ)).toBe('3 days ago');
    expect(formatRelativeDay('2026-10-12T12:00:00Z', now, TZ)).toBe('Oct 12');
  });
});

describe('formatBookMeta', () => {
  const book: BookWithProgress = {
    id: '1',
    title: 'T',
    author: 'A',
    totalPages: 320,
    status: 'reading',
    finishedAt: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    progress: 142,
    percent: 44,
  };

  it('matches the Figma book rows', () => {
    expect(formatBookMeta(book, TZ)).toBe('Reading · p. 142 of 320');
    expect(
      formatBookMeta({ ...book, status: 'want_to_read', progress: 0, totalPages: 688 }, TZ),
    ).toBe('Want to read · 688 pages');
    expect(
      formatBookMeta({ ...book, status: 'finished', finishedAt: '2026-10-12T20:00:00Z' }, TZ),
    ).toBe('Finished · Oct 12');
  });
});

describe('formatClock', () => {
  it('pads hours, minutes and seconds', () => {
    expect(formatClock(0)).toBe('00:00:00');
    expect(formatClock(41 * 60 + 12)).toBe('00:41:12');
    expect(formatClock(12 * 3600 + 5.9)).toBe('12:00:05');
  });
});

describe('date keys', () => {
  it('formats a key without shifting it through the local time zone', () => {
    expect(formatDateKey('2026-10-01', 'MMM d')).toBe('Oct 1');
    expect(formatDateKey('2026-10-31', 'MMMM yyyy')).toBe('October 2026');
  });

  it('formats ranges', () => {
    expect(formatKeyRange('2026-06-03', '2026-06-23')).toBe('Jun 3 – Jun 23');
    expect(formatKeyRange('2026-06-03', '2026-06-03')).toBe('Jun 3');
  });
});

describe('deltas', () => {
  it('formats counts with separators', () => {
    expect(formatCount(1240)).toBe('1,240');
  });

  it('signs differences', () => {
    expect(formatDelta(18, '%')).toBe('+18%');
    expect(formatDelta(-3.4, ' p/h')).toBe('−3 p/h');
    expect(formatDelta(0, '%')).toBe('+0%');
  });

  it('formats minute differences like Figma', () => {
    expect(formatMinutesDelta(125)).toBe('+2h 05m');
    expect(formatMinutesDelta(-45)).toBe('−45 min');
    expect(formatMinutesDelta(-600)).toBe('−10h 00m');
  });
});

describe('formatSessionDuration', () => {
  it('shows seconds, padding the units after the first', () => {
    expect(formatSessionDuration(41 + 12 / 60)).toBe('41m 12s');
    expect(formatSessionDuration(30)).toBe('30m 00s');
    expect(formatSessionDuration(65.5)).toBe('1h 05m 30s');
    expect(formatSessionDuration(0.75)).toBe('45s');
    expect(formatSessionDuration(0)).toBe('0s');
  });

  it('rounds to the nearest second', () => {
    expect(formatSessionDuration(59.999)).toBe('1h 00m 00s');
  });
});
