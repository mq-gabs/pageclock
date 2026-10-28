import { byMonth, type StatsDailyResponse, type StatsPeriod } from '@reading-tracker/shared';
import type { ChartBar } from '@/components/pages-bar-chart';
import { formatDateKey } from './format';

type Day = StatsDailyResponse['days'][number];

/**
 * Bars for the Pages chart, up to today: one per day for a week or month, one per month for a
 * year. The current day (or month) is marked and labelled "Today" (or "This month").
 */
export function chartBars(period: StatsPeriod, days: readonly Day[], today: string): ChartBar[] {
  const past = days.filter((d) => d.date <= today);
  if (period === 'year') {
    const thisMonth = today.slice(0, 7);
    return byMonth(past).map((m) => ({
      key: m.month,
      label: formatDateKey(`${m.month}-01`, 'MMM'),
      title: formatDateKey(`${m.month}-01`, 'MMMM yyyy'),
      pages: m.pages,
      minutes: m.minutes,
      current: m.month === thisMonth,
    }));
  }
  return past.map((d) => ({
    key: d.date,
    label: d.date === today ? 'Today' : formatDateKey(d.date, period === 'week' ? 'EEE' : 'MMM d'),
    title: formatDateKey(d.date, 'EEE, MMM d'),
    pages: d.pages,
    minutes: d.minutes,
    current: d.date === today,
  }));
}

/**
 * Which bars get an axis label. Weeks label every day. Otherwise mobile shows first, middle and
 * last; desktop labels a month weekly (Oct 1, 8, 15, 22 and the last day) and a year monthly.
 */
export function chartTicks(period: StatsPeriod, bars: readonly ChartBar[], desktop: boolean) {
  const n = bars.length;
  let indices: number[];
  if (period === 'week' || (period === 'year' && desktop)) {
    indices = bars.map((_, i) => i);
  } else if (desktop) {
    indices = [];
    for (let i = 0; i < n - 3; i += 7) indices.push(i);
    indices.push(n - 1);
  } else {
    indices = [0, Math.floor((n - 1) / 2), n - 1];
  }
  return [...new Set(indices)].flatMap((i) => {
    const bar = bars[i];
    return bar ? [bar.key] : [];
  });
}
