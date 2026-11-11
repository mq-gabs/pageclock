'use client';

import { Button } from '@/components/ui/button';
import { toast } from '@/lib/toast';

const card = 'flex flex-col gap-5 rounded-card border border-border bg-surface p-5 lg:p-6';

export function DevView() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:gap-6 lg:px-12 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-sm font-bold text-ink lg:text-title">Dev</h1>
        <p className="text-[14px] text-muted">Manual UI checks. Only available in development.</p>
      </div>

      <section aria-labelledby="dev-toasts" className={`${card} max-w-140`}>
        <div className="flex flex-col gap-1">
          <h2 id="dev-toasts" className="text-[17px] font-semibold text-ink">
            Toasts
          </h2>
          <p className="text-[14px] text-muted">
            Bottom-right, newest on top, gone after 5 seconds.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="sm" onClick={() => toast.success('Session saved')}>
            Success
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.warning('Pages 120–130 were skipped since your last session.', {
                title: 'Check the pages',
              })
            }
          >
            Warning
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => toast.error('Couldn’t reach the server. Check your connection.')}
          >
            Error
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              toast.success('Book added');
              setTimeout(() => toast.warning('Time overlaps another session'), 300);
              setTimeout(() => toast.error('Import failed', { title: 'Backup' }), 600);
            }}
          >
            Burst of 3
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.success('This one stays for 15 seconds.', { title: 'Long', duration: 15_000 })
            }
          >
            Long (15 s)
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast.dismissAll()}>
            Dismiss all
          </Button>
        </div>
      </section>
    </main>
  );
}
