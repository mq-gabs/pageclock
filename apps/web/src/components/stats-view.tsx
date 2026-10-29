'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  addDays,
  bestDay,
  periodRange,
  type StatsDailyResponse,
  type StatsPeriod,
  type StatsSummaryResponse,
} from '@reading-tracker/shared';
import { Button } from '@/components/ui/button';
import {
  formatCount,
  formatDateKey,
  formatDelta,
  formatDuration,
  formatKeyRange,
  formatMinutesDelta,
  formatSpeed,
} from '@/lib/format';
import { useStatsDaily, useStatsSummary, useStreaks } from '@/lib/queries';
import { chartBars, chartTicks } from '@/lib/stats-chart';
import { useIsDesktop } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';
import { PagesBarChart } from './pages-bar-chart';
import { PeriodSwitcher } from './period-switcher';
import { ReadingCalendar } from './reading-calendar';
import { StatCard } from './stat-card';
import { Skeleton, StatsBodySkeleton } from './skeletons';
import { EmptyState, ErrorState } from './states';
import { AppLink } from './app-link';

/** "October 2026", "Oct 26 – Nov 1" or "2026". */
function periodTitle(period: StatsPeriod, range: { from: string; to: string }) {
  if (period === 'month') return formatDateKey(range.from, 'MMMM yyyy');
  if (period === 'year') return formatDateKey(range.from, 'yyyy');
  return formatKeyRange(range.from, range.to);
}

/** How the previous period is named: long for the subtitle, short for "vs …". */
function previousName(period: StatsPeriod, from: string) {
  if (period === 'month') {
    return { long: formatDateKey(from, 'MMMM'), short: formatDateKey(from, 'MMM') };
  }
  if (period === 'year')
    return { long: formatDateKey(from, 'yyyy'), short: formatDateKey(from, 'yyyy') };
  return { long: 'the week before', short: 'prev. week' };
}

const card = 'rounded-card border border-border bg-surface p-4 lg:p-5';
const cardTitle = 'text-[17px] font-semibold text-ink';
const cardMeta = 'text-label text-muted';

/** The Stats screen: period switcher, four totals, pages chart, reading-days calendar, streaks. */
export function StatsView() {
  const [period, setPeriod] = useState<StatsPeriod>('month');
  // The day whose period is shown; undefined means today (the API knows which day that is).
  const [date, setDate] = useState<string>();
  const summary = useStatsSummary(period, date);
  const streaks = useStreaks();
  const desktop = useIsDesktop();

  const s = summary.data;
  const today = s?.today;
  const lastShown = s ? (s.current.to < s.today ? s.current.to : s.today) : undefined;
  const calendarRange = lastShown ? periodRange('month', lastShown) : undefined;
  // In the Month view both queries ask for the same range, so only one request is made.
  const chartDaily = useStatsDaily(s ? { from: s.current.from, to: s.current.to } : undefined);
  const calendarDaily = useStatsDaily(calendarRange);

  if (summary.isPending) {
    return <StatsShell period={period} onPeriod={setPeriod} body={<StatsBodySkeleton />} />;
  }
  if (summary.isError || !s || !today) {
    return (
      <StatsShell
        period={period}
        onPeriod={setPeriod}
        body={<ErrorState message="Couldn’t load your stats." onRetry={() => summary.refetch()} />}
      />
    );
  }

  const isCurrent = s.current.to >= today;
  const title = periodTitle(period, s.current);
  const prev = previousName(period, s.previous.from);
  const nav = {
    title,
    onPrevious: () => setDate(addDays(s.current.from, -1)),
    onNext: () => setDate(addDays(s.current.to, 1)),
    canGoNext: !isCurrent,
    unit: period,
  };

  return (
    <StatsShell
      period={period}
      onPeriod={setPeriod}
      subtitle={`${title} · compared with ${prev.long}`}
      nav={nav}
      body={
        <>
          {streaks.data?.lastReadingDay === null && (
            <EmptyState
              title="No reading logged yet"
              action={
                <Button asChild size="sm">
                  <AppLink href="/read">Start reading</AppLink>
                </Button>
              }
            >
              Your totals, chart, calendar and streaks fill in as you log sessions or use the timer.
            </EmptyState>
          )}
          <Totals summary={s} vs={prev.short} isCurrent={isCurrent} />
          <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-4">
            <ChartCard
              period={period}
              summary={s}
              days={chartDaily.data?.days}
              failed={chartDaily.isError}
              onRetry={() => chartDaily.refetch()}
              desktop={desktop}
            />
            <div className="flex flex-col gap-4">
              <section
                aria-labelledby="calendar-heading"
                className={cn(card, 'flex flex-col gap-3')}
              >
                <CalendarHeader
                  month={calendarRange?.from}
                  showMonth={period !== 'month'}
                  days={calendarDaily.data?.days}
                  today={today}
                />
                {calendarDaily.data ? (
                  <ReadingCalendar days={calendarDaily.data.days} today={today} />
                ) : (
                  <DailyState
                    failed={calendarDaily.isError}
                    what="the calendar"
                    onRetry={() => calendarDaily.refetch()}
                  />
                )}
              </section>
              <Streaks
                data={streaks.data}
                failed={streaks.isError}
                onRetry={() => streaks.refetch()}
              />
            </div>
          </div>
        </>
      }
    />
  );
}

interface NavProps {
  title: string;
  onPrevious: () => void;
  onNext: () => void;
  canGoNext: boolean;
  unit: StatsPeriod;
}

function StatsShell({
  period,
  onPeriod,
  subtitle,
  nav,
  body,
}: {
  period: StatsPeriod;
  onPeriod: (period: StatsPeriod) => void;
  subtitle?: string;
  nav?: NavProps;
  body: React.ReactNode;
}) {
  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-6 lg:gap-6 lg:px-12 lg:py-10">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-title-sm font-bold text-ink lg:text-title">Stats</h1>
          {subtitle && <p className="hidden text-[14px] text-muted lg:block">{subtitle}</p>}
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-4">
          {nav && <PeriodNav {...nav} className="hidden lg:flex" />}
          <PeriodSwitcher value={period} onChange={onPeriod} className="lg:w-[315px]" />
          {nav && <PeriodNav {...nav} className="lg:hidden" />}
        </div>
      </header>
      {body}
    </main>
  );
}

const arrow =
  'flex size-8 items-center justify-center rounded-button text-ink hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:text-border disabled:hover:bg-transparent';

/** "October 2026  ‹ ›" on mobile, "‹ October 2026 ›" on desktop. */
function PeriodNav({
  title,
  onPrevious,
  onNext,
  canGoNext,
  unit,
  className,
}: NavProps & { className?: string }) {
  const previous = (
    <button type="button" className={arrow} onClick={onPrevious} aria-label={`Previous ${unit}`}>
      <ChevronLeft aria-hidden size={18} />
    </button>
  );
  const next = (
    <button
      type="button"
      className={arrow}
      onClick={onNext}
      disabled={!canGoNext}
      aria-label={`Next ${unit}`}
    >
      <ChevronRight aria-hidden size={18} />
    </button>
  );
  return (
    <div className={cn('flex items-center', className)}>
      <h2 aria-live="polite" className="flex-1 text-[17px] font-semibold text-ink lg:hidden">
        {title}
      </h2>
      {previous}
      <p aria-live="polite" className="hidden px-1 text-[15px] font-semibold text-ink lg:block">
        {title}
      </p>
      {next}
    </div>
  );
}

function Totals({
  summary: s,
  vs,
  isCurrent,
}: {
  summary: StatsSummaryResponse;
  vs: string;
  isCurrent: boolean;
}) {
  const { current, previous, change, daysSoFar } = s;
  const pagesSub =
    change.pages !== null
      ? `${formatDelta(change.pages, '%')} vs ${vs}`
      : previous.pages === 0
        ? `none in ${vs}`
        : undefined;
  const speedSub =
    current.speed !== null && previous.speed !== null
      ? `${formatDelta(current.speed - previous.speed, ' p/h')} vs ${vs}`
      : 'pages/hour';
  const daysSub =
    daysSoFar > 0
      ? `${Math.round((current.readingDays / daysSoFar) * 100)}% of days${isCurrent ? ' so far' : ''}`
      : undefined;

  const booksDelta = current.books - previous.books;
  const booksSub =
    previous.books === 0
      ? `none in ${vs}`
      : booksDelta === 0
        ? `same as ${vs}`
        : `${formatDelta(booksDelta)} vs ${vs}`;

  return (
    <section aria-label="Totals" className="grid grid-cols-2 gap-2.5 lg:grid-cols-5 lg:gap-4">
      <StatCard label="Pages" value={formatCount(current.pages)} sub={pagesSub} />
      <StatCard
        label="Time"
        value={formatDuration(current.minutes)}
        sub={
          previous.minutes === 0
            ? `none in ${vs}`
            : `${formatMinutesDelta(current.minutes - previous.minutes)} vs ${vs}`
        }
      />
      <StatCard label="Avg speed" value={formatSpeed(current.speed)} sub={speedSub} />
      <StatCard
        label="Reading days"
        value={`${current.readingDays} of ${daysSoFar}`}
        sub={daysSub}
      />
      <StatCard
        label="Books"
        value={formatCount(current.books)}
        sub={booksSub}
        className="col-span-2 lg:col-span-1"
      />
    </section>
  );
}

function ChartCard({
  period,
  summary: s,
  days,
  failed,
  onRetry,
  desktop,
}: {
  period: StatsPeriod;
  summary: StatsSummaryResponse;
  days: StatsDailyResponse['days'] | undefined;
  failed: boolean;
  onRetry: () => void;
  desktop: boolean;
}) {
  const bars = days ? chartBars(period, days, s.today) : [];
  const best = bestDay(bars);
  const unit = period === 'year' ? 'month' : 'day';
  let meta = 'No reading yet';
  if (best) {
    const when = period === 'year' ? `in ${best.label}` : `on ${formatDateKey(best.key, 'MMM d')}`;
    meta =
      desktop && period !== 'year' && s.current.readingDays > 0
        ? `Avg ${Math.round(s.current.pages / s.current.readingDays)} on reading days · best ${best.pages} ${when}`
        : `Best: ${best.pages} ${when}`;
  }

  return (
    <section aria-labelledby="chart-heading" className={cn(card, 'flex flex-col gap-4')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="chart-heading" className={cardTitle}>
          Pages per {unit}
        </h2>
        {days && <p className={cardMeta}>{meta}</p>}
      </div>
      <div className="h-[150px] lg:h-auto lg:min-h-[300px] lg:flex-1">
        {days ? (
          <PagesBarChart
            bars={bars}
            ticks={chartTicks(period, bars, desktop)}
            label={`Pages per ${unit}, ${s.current.pages} in total. ${meta}.`}
          />
        ) : (
          <DailyState failed={failed} what="the chart" onRetry={onRetry} />
        )}
      </div>
    </section>
  );
}

function CalendarHeader({
  month,
  showMonth,
  days,
  today,
}: {
  month: string | undefined;
  showMonth: boolean;
  days: { date: string; sessions: number }[] | undefined;
  today: string;
}) {
  const past = days?.filter((d) => d.date <= today) ?? [];
  const read = past.filter((d) => d.sessions > 0).length;
  const soFar = days !== undefined && days.some((d) => d.date > today);
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 id="calendar-heading" className={cardTitle}>
        Reading days
        {showMonth && month && (
          <span className="font-normal text-muted"> · {formatDateKey(month, 'MMMM')}</span>
        )}
      </h2>
      {days && (
        <p className={cardMeta}>
          {read} of {past.length}
          <span className="lg:hidden"> days</span>
          {soFar && ' so far'}
        </p>
      )}
    </div>
  );
}

function Streaks({
  data,
  failed,
  onRetry,
}: {
  data: ReturnType<typeof useStreaks>['data'];
  failed: boolean;
  onRetry: () => void;
}) {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  if (!data) {
    return failed ? (
      <ErrorState message="Couldn’t load streaks." onRetry={onRetry} className="py-6" />
    ) : (
      <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
        <Skeleton className="h-[86px] rounded-card" />
        <Skeleton className="h-[86px] rounded-card" />
      </div>
    );
  }
  return (
    <section aria-label="Streaks" className="grid grid-cols-2 gap-2.5 lg:gap-3">
      <StatCard
        label="Current streak"
        value={days(data.current)}
        sub={
          data.currentSince
            ? `since ${formatDateKey(data.currentSince, 'MMM d')}`
            : 'Read today to start one'
        }
      />
      <StatCard
        label="Longest streak"
        value={days(data.longest)}
        sub={
          data.longestFrom && data.longestTo
            ? formatKeyRange(data.longestFrom, data.longestTo)
            : 'No reading yet'
        }
      />
    </section>
  );
}

function DailyState({
  failed,
  what,
  onRetry,
}: {
  failed: boolean;
  what: string;
  onRetry: () => void;
}) {
  return failed ? (
    <ErrorState message={`Couldn’t load ${what}.`} onRetry={onRetry} />
  ) : (
    <Skeleton className="h-full min-h-[150px] w-full lg:min-h-[220px]" />
  );
}
