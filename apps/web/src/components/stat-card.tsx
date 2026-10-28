import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}

/** Figma "Stat card": label, big value, accent sub line. */
export function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-3.5',
        className,
      )}
    >
      <p className="truncate text-meta font-medium text-muted">{label}</p>
      <p className="truncate text-section-sm font-bold text-ink">{value}</p>
      {sub && <p className="truncate text-meta font-medium text-accent">{sub}</p>}
    </div>
  );
}
