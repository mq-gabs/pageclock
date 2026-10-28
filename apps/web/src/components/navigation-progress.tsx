'use client';

import { useNavigationPending } from '@/lib/navigation-progress';
import { cn } from '@/lib/utils';

/** A thin bar at the top while a route loads; it fades in after 150 ms so fast changes don't flash. */
export function NavigationProgress() {
  const pending = useNavigationPending();
  return (
    <>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden',
          pending ? 'nav-progress-visible' : 'opacity-0',
        )}
      >
        {pending && <div className="nav-progress-bar h-full w-1/3 bg-accent" />}
      </div>
      <span role="status" className="sr-only">
        {pending ? 'Loading page…' : ''}
      </span>
    </>
  );
}
