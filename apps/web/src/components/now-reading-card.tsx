'use client';

import { timerElapsedSeconds } from '@reading-tracker/shared';
import { Button } from '@/components/ui/button';
import { formatClock } from '@/lib/format';
import { useBooks, useTimer } from '@/lib/queries';
import { useNow } from '@/lib/use-now';
import { useStartReading } from '@/lib/use-start-reading';
import { AppLink } from './app-link';

const shell = 'flex flex-col rounded-card border border-border bg-bg p-3.5';
const label = 'text-[11px] font-semibold text-muted uppercase';
const title = 'mt-0.5 truncate text-[14px] font-semibold text-ink';
const meta = 'mt-1 truncate text-meta text-muted';

/**
 * Figma "Now reading" (sidebar): the running timer, or else the book read most recently,
 * with a button to start reading it. Hidden when there is neither.
 */
export function NowReadingCard() {
  const timer = useTimer();
  const reading = useBooks({ status: 'reading' });
  const start = useStartReading();
  const running = timer.data;
  const paused = running?.session.pausedAt != null;
  const now = useNow(Boolean(running) && !paused);

  if (timer.isPending) return null;

  if (running) {
    const { session, book } = running;
    const elapsed = timerElapsedSeconds(
      {
        startedAt: new Date(session.startedAt),
        pausedAt: session.pausedAt ? new Date(session.pausedAt) : null,
        pausedSeconds: session.pausedSeconds,
      },
      now,
    );
    return (
      <section aria-label="Now reading" className={shell}>
        <p className={label}>Now reading</p>
        <p className={title}>{book.title}</p>
        <p className={`${meta} tabular-nums`}>
          {paused ? 'Paused' : 'Running'} · {formatClock(elapsed)}
        </p>
        <Button asChild size="compact" className="mt-2">
          <AppLink href="/read">Open timer</AppLink>
        </Button>
      </section>
    );
  }

  // Books are listed most recently updated first, and saving a session bumps `updatedAt`.
  const book = reading.data?.books[0];
  if (!book) return null;
  return (
    <section aria-label="Now reading" className={shell}>
      <p className={label}>Now reading</p>
      <AppLink href={`/books/${book.id}`} className={`${title} hover:underline`}>
        {book.title}
      </AppLink>
      <p className={meta}>
        p. {book.progress} of {book.totalPages} · {book.percent}%
      </p>
      <Button
        size="compact"
        className="mt-2"
        disabled={start.isPending}
        onClick={() => start.start(book.id)}
      >
        Start reading
      </Button>
      {start.error && (
        <p role="alert" className="mt-1 text-meta text-destructive">
          {start.error.message}
        </p>
      )}
    </section>
  );
}
