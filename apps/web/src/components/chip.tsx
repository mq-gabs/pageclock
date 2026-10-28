import { cn } from '@/lib/utils';

interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

/** Figma Chip (default, active). A toggle button; pass `aria-pressed` semantics via `active`. */
export function Chip({ active = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3 py-1.5 text-label font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active
          ? 'border-accent bg-accent-tint text-accent'
          : 'border-border bg-surface text-ink hover:bg-bg',
        className,
      )}
      {...props}
    />
  );
}

/** The non-interactive chip used to show a book's status. */
export function StatusChip({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border border-accent bg-accent-tint px-3 py-1.5 text-label font-medium whitespace-nowrap text-accent',
        className,
      )}
      {...props}
    />
  );
}
