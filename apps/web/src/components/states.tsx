import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A polite "Loading …" with a spinner (still for people who prefer reduced motion). */
export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center justify-center gap-2 py-10 text-[14px] text-muted',
        className,
      )}
    >
      <Loader2 aria-hidden size={16} className="motion-safe:animate-spin" />
      {label}
    </div>
  );
}

/** A failed load, announced to screen readers, with a retry button when one makes sense. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn('flex flex-col items-center gap-3 py-10 text-center', className)}
    >
      <p className="text-[14px] text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Nothing to show yet: a short title, a hint and usually the action that fixes it. */
export function EmptyState({
  title,
  children,
  action,
  className,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2 rounded-card border border-border bg-surface px-5 py-8 text-center',
        className,
      )}
    >
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {children && <p className="max-w-sm text-[14px] text-muted">{children}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
