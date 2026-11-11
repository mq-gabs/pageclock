'use client';

import { AlertTriangle, CircleAlert, CircleCheck, X, type LucideIcon } from 'lucide-react';
import { toast, useToasts, type Toast, type ToastVariant } from '@/lib/toast';
import { cn } from '@/lib/utils';

const variants: Record<ToastVariant, { icon: LucideIcon; card: string; label: string }> = {
  success: {
    icon: CircleCheck,
    card: 'border-success bg-success-tint text-success',
    label: 'Success',
  },
  warning: {
    icon: AlertTriangle,
    card: 'border-warning bg-warning-tint text-warning',
    label: 'Warning',
  },
  error: {
    icon: CircleAlert,
    card: 'border-destructive bg-destructive-tint text-destructive',
    label: 'Error',
  },
};

function ToastCard({ item }: { item: Toast }) {
  const { icon: Icon, card, label } = variants[item.variant];
  return (
    // The outer grid row shrinks to 0 while collapsing, so the toasts above slide down.
    <li className="toast-slot" data-phase={item.phase}>
      <div className="min-h-0">
        <div className="pt-2">
          <div
            className={cn(
              'toast-card pointer-events-auto flex items-start gap-3 rounded-button border p-3.5 shadow-lg',
              card,
            )}
          >
            <Icon aria-hidden size={20} className="mt-px shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="sr-only">{label}: </span>
              {item.title && <p className="text-[14px] font-semibold">{item.title}</p>}
              <p
                className={cn(
                  'text-ink wrap-break-word',
                  item.title ? 'text-label' : 'text-[14px] font-medium',
                )}
              >
                {item.message}
              </p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => toast.dismiss(item.id)}
              className="-m-1 shrink-0 rounded-cell p-1 text-muted hover:text-ink"
            >
              <X aria-hidden size={16} />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

/**
 * Bottom-right stack of toasts; each new one sits above the previous. Mounted once in the
 * root layout. On mobile it stays above the bottom tab bar.
 */
export function Toaster() {
  const toasts = useToasts();
  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-20 left-4 z-60 sm:left-auto sm:w-90 lg:right-6 lg:bottom-6"
    >
      <ol className="flex flex-col-reverse">
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} />
        ))}
      </ol>
    </section>
  );
}
