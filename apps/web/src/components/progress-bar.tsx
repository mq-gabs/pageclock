import { cn } from '@/lib/utils';

interface ProgressBarProps {
  percent: number;
  size?: 'sm' | 'md';
  className?: string;
  label?: string;
}

export function ProgressBar({ percent, size = 'sm', className, label }: ProgressBarProps) {
  const value = Math.min(100, Math.max(0, percent));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label={label}
      className={cn(
        'w-full overflow-hidden bg-border',
        size === 'sm' ? 'h-1.5 rounded-[3px]' : 'h-2 rounded-[4px]',
        className,
      )}
    >
      <div className="h-full rounded-[inherit] bg-accent" style={{ width: `${value}%` }} />
    </div>
  );
}
