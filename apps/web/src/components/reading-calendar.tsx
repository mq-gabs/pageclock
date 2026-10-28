import { heatLevel, type HeatLevel } from '@reading-tracker/shared';
import { formatDateKey } from '@/lib/format';
import { cn } from '@/lib/utils';

const heatClass: Record<HeatLevel, string> = {
  0: 'bg-heat-0 text-ink',
  1: 'bg-heat-1 text-ink',
  2: 'bg-heat-2 text-ink',
  3: 'bg-heat-3 text-surface',
  4: 'bg-heat-4 text-surface',
};

const weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Figma "ReadingCalendar": a Monday-first month grid shaded by pages read (heat-0 … heat-4).
 * Days after today are blank cells; today has a dark outline.
 */
export function ReadingCalendar({
  days,
  today,
}: {
  /** Every day of the month, in order. */
  days: { date: string; pages: number }[];
  today: string;
}) {
  const first = days[0];
  if (!first) return null;
  const [y = 0, m = 1, d = 1] = first.date.split('-').map(Number);
  const leading = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5 lg:gap-[7px]" aria-hidden>
        {weekdays.map((day, i) => (
          <span key={i} className="text-center text-meta font-medium text-muted">
            {day}
          </span>
        ))}
      </div>
      <ol className="-mt-1.5 grid grid-cols-7 gap-1.5 lg:-mt-1 lg:gap-[7px]">
        {Array.from({ length: leading }, (_, i) => (
          <li key={`blank-${i}`} aria-hidden />
        ))}
        {days.map((day) => {
          const future = day.date > today;
          const isToday = day.date === today;
          const date = formatDateKey(day.date, 'MMM d');
          const label = future
            ? date
            : `${date}: ${day.pages} ${day.pages === 1 ? 'page' : 'pages'}`;
          return (
            <li
              key={day.date}
              aria-label={isToday ? `Today, ${label}` : label}
              aria-current={isToday ? 'date' : undefined}
              title={future ? undefined : label}
              className={cn(
                'flex h-9 items-center justify-center rounded-cell text-label font-medium lg:h-8 lg:text-meta',
                future
                  ? 'border border-border bg-surface text-ink'
                  : heatClass[heatLevel(day.pages)],
                isToday && 'border-2 border-ink',
              )}
            >
              <span aria-hidden>{Number(day.date.slice(8))}</span>
            </li>
          );
        })}
      </ol>
      <div className="flex items-center justify-end gap-1.5 text-meta text-muted" aria-hidden>
        <span className="mr-0.5">Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className={cn('size-3 rounded-[3px]', heatClass[level])} />
        ))}
        <span className="ml-0.5">More pages</span>
      </div>
    </div>
  );
}
