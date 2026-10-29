import { describe, expect, it } from 'vitest';
import { chartBars, chartTicks } from './stats-chart';

const book = (pages: number, minutes: number) => ({ bookId: 'b1', title: 'Dune', pages, minutes });
const day = (date: string, pages = 0, minutes = 0) => ({
  date,
  pages,
  minutes,
  sessions: pages > 0 ? 1 : 0,
  books: pages > 0 ? [book(pages, minutes)] : [],
});
const october = Array.from({ length: 31 }, (_, i) =>
  day(`2026-10-${String(i + 1).padStart(2, '0')}`, i === 19 ? 90 : 10, 20),
);

describe('chartBars', () => {
  it('stops at today and marks it', () => {
    const bars = chartBars('month', october, '2026-10-28');
    expect(bars).toHaveLength(28);
    expect(bars[0]).toMatchObject({ key: '2026-10-01', label: 'Oct 1', current: false });
    expect(bars.at(-1)).toMatchObject({ label: 'Today', current: true, title: 'Wed, Oct 28' });
  });

  it('keeps every day of a past period', () => {
    expect(chartBars('month', october, '2026-11-05')).toHaveLength(31);
  });

  it('labels a week by weekday', () => {
    const week = october.slice(25, 32); // Mon Oct 26 – Sat Oct 31
    expect(chartBars('week', week, '2026-10-28').map((b) => b.label)).toEqual([
      'Mon',
      'Tue',
      'Today',
    ]);
  });

  it('adds up a year by month', () => {
    const days = [day('2026-09-30', 100, 120), ...october];
    const bars = chartBars('year', days, '2026-10-28');
    expect(bars.map((b) => [b.label, b.pages, b.current])).toEqual([
      ['Sep', 100, false],
      ['Oct', 27 * 10 + 90, true],
    ]);
    expect(bars[1]?.books).toEqual([book(27 * 10 + 90, 28 * 20)]);
  });

  it('passes each day’s books to its bar', () => {
    const bars = chartBars('month', october, '2026-10-28');
    expect(bars[19]?.books).toEqual([book(90, 20)]);
  });
});

describe('chartTicks', () => {
  const bars = chartBars('month', october, '2026-10-28');

  it('labels first, middle and today on mobile (Oct 1, Oct 14, Today)', () => {
    expect(chartTicks('month', bars, false)).toEqual(['2026-10-01', '2026-10-14', '2026-10-28']);
  });

  it('labels weekly on desktop (Oct 1, 8, 15, 22, Today)', () => {
    expect(chartTicks('month', bars, true)).toEqual([
      '2026-10-01',
      '2026-10-08',
      '2026-10-15',
      '2026-10-22',
      '2026-10-28',
    ]);
  });

  it('handles a single bar', () => {
    expect(chartTicks('month', bars.slice(0, 1), false)).toEqual(['2026-10-01']);
    expect(chartTicks('month', bars.slice(0, 1), true)).toEqual(['2026-10-01']);
  });
});
