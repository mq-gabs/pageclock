'use client';

import { CloudOff } from 'lucide-react';
import { failureBannerThreshold, timerQueue, useTimerQueue } from '@/lib/timer-queue';

/**
 * A full-width warning stripe at the top of the app that pushes the content down. It takes any
 * message; today only the timer queue uses it (`TimerConnectionBanner`).
 */
export function ConnectionBanner({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex items-start gap-3 border-b border-warning/30 bg-warning-tint px-5 py-3 text-warning lg:items-center lg:px-12"
    >
      <CloudOff aria-hidden size={18} className="mt-0.5 shrink-0 lg:mt-0" />
      <p className="min-w-0 flex-1 text-[14px]">{message}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-button px-2 py-0.5 text-[14px] font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** Shown after `failureBannerThreshold` (3) failed timer sends in a row; hides after the next success. */
export function TimerConnectionBanner() {
  const { failures } = useTimerQueue();
  if (failures < failureBannerThreshold) return null;
  return (
    <ConnectionBanner
      message="Can’t reach the server. Your timer changes are saved on this device and will sync when you’re back online."
      actionLabel="Retry now"
      onAction={() => timerQueue.retryNow()}
    />
  );
}
