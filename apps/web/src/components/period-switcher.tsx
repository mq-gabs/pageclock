import { statsPeriods, type StatsPeriod } from '@reading-tracker/shared';
import { cn } from '@/lib/utils';

const labels: Record<StatsPeriod, string> = { week: 'Week', month: 'Month', year: 'Year' };

/** Figma "PeriodSwitcher": a segmented control. (Figma's "Custom" range is not in the MVP.) */
export function PeriodSwitcher({
  value,
  onChange,
  className,
}: {
  value: StatsPeriod;
  onChange: (period: StatsPeriod) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Period"
      className={cn('flex rounded-button border border-border bg-surface p-1', className)}
    >
      {statsPeriods.map((period) => {
        const active = period === value;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(period)}
            className={cn(
              'flex-1 rounded-[8px] px-4 py-1.5 text-[15px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-accent font-semibold text-surface'
                : 'font-medium text-muted hover:text-ink',
            )}
          >
            {labels[period]}
          </button>
        );
      })}
    </div>
  );
}
