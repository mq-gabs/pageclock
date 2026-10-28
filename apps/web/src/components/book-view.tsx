'use client';

import { useState } from 'react';
import Link from 'next/link';
import { bookStatusLabels } from '@reading-tracker/shared';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api';
import { appTimeZone } from '@/lib/config';
import { formatDuration, formatRelativeDay, formatShortDate, formatSpeed } from '@/lib/format';
import { useBook, useBookSessions, useTimer } from '@/lib/queries';
import { useStartReading } from '@/lib/use-start-reading';
import { BookCover } from './book-cover';
import { BookFormDialog } from './book-form-dialog';
import { StatusChip } from './chip';
import { ProgressBar } from './progress-bar';
import { SessionList } from './session-list';
import { StatCard } from './stat-card';
import { ErrorState, LoadingState } from './states';

/** The Book screen. Also rendered behind the Log session dialog on desktop. */
export function BookView({ id }: { id: string }) {
  const { data, isPending, error, refetch } = useBook(id);
  const sessions = useBookSessions(id);
  const [editing, setEditing] = useState(false);
  const timer = useTimer();
  const start = useStartReading();

  const back = (
    <Link
      href="/library"
      className="self-start text-[15px] font-medium text-accent hover:underline"
    >
      ‹ Library
    </Link>
  );

  if (isPending) {
    return (
      <main className="flex flex-col gap-4 px-5 pt-6 lg:px-12 lg:py-10">
        {back}
        <LoadingState label="Loading book…" />
      </main>
    );
  }

  if (error) {
    const notFound =
      error instanceof ApiRequestError && (error.status === 404 || error.status === 400);
    return (
      <main className="flex flex-col gap-4 px-5 pt-6 lg:px-12 lg:py-10">
        {back}
        <ErrorState
          message={
            notFound ? 'This book doesn’t exist or was deleted.' : 'Couldn’t load this book.'
          }
          onRetry={notFound ? undefined : () => refetch()}
        />
      </main>
    );
  }

  const { book, stats } = data;
  const footer = stats.firstReadAt
    ? `Started ${formatShortDate(stats.firstReadAt, appTimeZone)} · last read ${formatRelativeDay(stats.lastReadAt ?? stats.firstReadAt, new Date(), appTimeZone)}`
    : 'Not started yet';

  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:max-w-[960px] lg:gap-6 lg:px-12 lg:py-10">
      <div className="flex items-center justify-between">
        {back}
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Edit book"
          className="rounded-button text-[15px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Edit
        </button>
      </div>

      <header className="flex items-start gap-4 lg:gap-6">
        <BookCover size="md" className="lg:hidden" />
        <BookCover size="lg" className="hidden lg:flex" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 lg:gap-2">
          <h1 className="text-section-sm font-bold text-ink lg:text-title">{book.title}</h1>
          <p className="text-[14px] text-muted lg:text-body">
            {book.author} · {book.totalPages} pages
          </p>
          <StatusChip>{bookStatusLabels[book.status]}</StatusChip>
        </div>
      </header>

      <section
        aria-label="Progress"
        className="flex flex-col gap-2.5 rounded-card border border-border bg-surface p-4"
      >
        <div className="flex items-end justify-between font-semibold">
          <p className="text-[17px] text-ink">
            Page {book.progress} of {book.totalPages}
          </p>
          <p className="text-[15px] text-accent">{book.percent}%</p>
        </div>
        <ProgressBar percent={book.percent} size="md" label="Reading progress" />
        <p className="text-meta text-muted">{footer}</p>
      </section>

      <section aria-label="Book stats" className="grid grid-cols-3 gap-2.5 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Pages"
          value={String(stats.pages)}
          sub="read so far"
          className="hidden lg:flex"
        />
        <StatCard label="Speed" value={formatSpeed(stats.speed)} sub="average" />
        <StatCard
          label="Time"
          value={formatDuration(stats.minutes)}
          sub={`${stats.sessions} ${stats.sessions === 1 ? 'session' : 'sessions'}`}
        />
        <StatCard
          label="Days"
          value={String(stats.readingDays)}
          sub={stats.readingDays === 1 ? 'reading day' : 'reading days'}
        />
      </section>

      <div className="flex gap-2.5 lg:max-w-[480px]">
        {timer.data ? (
          <Button className="flex-1" asChild>
            <Link href="/read">Open timer</Link>
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={timer.isPending || start.isPending}
            onClick={() => start.start(book.id)}
          >
            Start reading
          </Button>
        )}
        <Button variant="secondary" className="flex-1" asChild>
          <Link href={`/books/${book.id}/log`}>Log session</Link>
        </Button>
      </div>

      {start.error && (
        <p role="alert" className="-mt-2 text-meta text-destructive">
          {start.error.message}
        </p>
      )}

      <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
        <h2 id="sessions-heading" className="text-[17px] font-semibold text-ink">
          Sessions
        </h2>
        {sessions.isPending ? (
          <LoadingState label="Loading sessions…" className="py-6" />
        ) : sessions.isError ? (
          <ErrorState
            message="Couldn’t load sessions."
            onRetry={() => sessions.refetch()}
            className="py-6"
          />
        ) : (
          <SessionList sessions={sessions.data.sessions} />
        )}
      </section>

      <BookFormDialog mode="edit" book={book} open={editing} onOpenChange={setEditing} />
    </main>
  );
}
