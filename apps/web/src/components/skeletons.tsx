import { cn } from '@/lib/utils';

/** A pulsing placeholder block (still for people who prefer reduced motion). */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn('rounded-[6px] bg-heat-0 motion-safe:animate-pulse', className)}
    />
  );
}

/** Announces the loading state once for a whole skeleton screen. */
function Busy({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-label={label} aria-busy className={className}>
      {children}
    </div>
  );
}

const card = 'rounded-card border border-border bg-surface';

/** Book rows as in the Library list (or its 3-column grid on desktop). */
export function BookRowsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <Busy
      label="Loading books"
      className={cn('flex flex-col gap-2.5 lg:grid lg:grid-cols-3 lg:gap-4', className)}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cn(card, 'flex items-center gap-3.5 p-3')}>
          <Skeleton className="aspect-[2/3] w-12 shrink-0 rounded-[4px]" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-1.5 w-full rounded-[3px]" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </Busy>
  );
}

export function LibrarySkeleton() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:gap-6 lg:px-12 lg:py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-title-sm font-bold text-ink lg:text-title">Library</h1>
        <Skeleton className="h-10.5 w-28 rounded-button lg:h-12 lg:w-36" />
      </div>
      <Skeleton className="h-11 w-full rounded-input lg:hidden" />
      <div className="flex gap-2">
        {[16, 20, 28, 20].map((w, i) => (
          <Skeleton key={i} className="h-8 rounded-full" style={{ width: `${w * 4}px` }} />
        ))}
      </div>
      <BookRowsSkeleton count={6} />
    </main>
  );
}

/** Session rows, as on the Book page. */
export function SessionsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <Busy label="Loading sessions" className={cn(card, 'flex flex-col')}>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </Busy>
  );
}

/** The Book page body, below its back link. */
export function BookSkeleton() {
  return (
    <Busy label="Loading book" className="flex flex-col gap-4 lg:gap-6">
      <div className="flex items-start gap-4 lg:gap-6">
        <Skeleton className="aspect-[2/3] w-[88px] shrink-0 lg:w-[140px]" />
        <div className="flex flex-1 flex-col gap-2.5 pt-1">
          <Skeleton className="h-6 w-3/4 lg:h-8" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-[104px] w-full rounded-card" />
      <div className="grid grid-cols-3 gap-2.5 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className={cn('h-[86px] rounded-card', i === 0 && 'hidden lg:block')} />
        ))}
      </div>
      <div className="flex gap-2.5 lg:max-w-[480px]">
        <Skeleton className="h-12 flex-1 rounded-button" />
        <Skeleton className="h-12 flex-1 rounded-button" />
      </div>
      <Skeleton className="h-5 w-24" />
      <SessionsSkeleton />
    </Busy>
  );
}

/** The Book page while its route loads, with the back link already in place. */
export function BookPageSkeleton() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:max-w-[960px] lg:gap-6 lg:px-12 lg:py-10">
      <span className="text-[15px] font-medium text-accent">‹ Library</span>
      <BookSkeleton />
    </main>
  );
}

/** The Read screen: a timer card (mobile) or a centered card (desktop). */
export function TimerSkeleton() {
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] flex-col px-5 pt-6 pb-6 lg:min-h-screen lg:items-center lg:justify-center lg:p-10">
      <Busy
        label="Loading timer"
        className="flex flex-1 flex-col gap-3 lg:w-[560px] lg:flex-none lg:items-center lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-10"
      >
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-[148px] w-full rounded-card lg:h-[120px]" />
        <Skeleton className="mt-3 h-12 w-full rounded-input" />
        <div className="mt-auto grid w-full grid-cols-2 gap-2.5 pt-6 lg:mt-2 lg:pt-0">
          <Skeleton className="h-12 rounded-button" />
          <Skeleton className="h-12 rounded-button" />
        </div>
      </Busy>
    </main>
  );
}

/** The Stats body: four totals, chart, calendar and streaks. */
export function StatsBodySkeleton() {
  return (
    <Busy label="Loading stats" className="flex flex-col gap-4 lg:gap-6">
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[86px] rounded-card" />
        ))}
      </div>
      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_420px]">
        <Skeleton className="h-[220px] rounded-card lg:h-[418px]" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[300px] rounded-card lg:h-[311px]" />
          <div className="grid grid-cols-2 gap-2.5 lg:gap-3">
            <Skeleton className="h-[86px] rounded-card" />
            <Skeleton className="h-[86px] rounded-card" />
          </div>
        </div>
      </div>
    </Busy>
  );
}

export function StatsSkeleton() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-6 lg:gap-6 lg:px-12 lg:py-10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <h1 className="text-title-sm font-bold text-ink lg:text-title">Stats</h1>
        <Skeleton className="h-[42px] w-full rounded-button lg:w-[315px]" />
      </div>
      <StatsBodySkeleton />
    </main>
  );
}

/** A form inside a dialog while its data loads. */
export function DialogFormSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <Busy label="Loading" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-12 w-full rounded-input" />
        </div>
      ))}
      <div className="flex gap-2.5">
        <Skeleton className="h-12 flex-1 rounded-button" />
        <Skeleton className="h-12 flex-1 rounded-button" />
      </div>
    </Busy>
  );
}
