'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { bookStatusLabels } from '@reading-tracker/shared';
import { BookCover } from '@/components/book-cover';
import { BookFormDialog } from '@/components/book-form-dialog';
import { StatusChip } from '@/components/chip';
import { ProgressBar } from '@/components/progress-bar';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { ApiRequestError } from '@/lib/api';
import { appTimeZone } from '@/lib/config';
import { formatDuration, formatRelativeDay, formatShortDate, formatSpeed } from '@/lib/format';
import { useBook } from '@/lib/queries';

export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isPending, error, refetch } = useBook(id);
  const [editing, setEditing] = useState(false);

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
        <p className="py-10 text-center text-[14px] text-muted">Loading book…</p>
      </main>
    );
  }

  if (error) {
    const notFound =
      error instanceof ApiRequestError && (error.status === 404 || error.status === 400);
    return (
      <main className="flex flex-col gap-4 px-5 pt-6 lg:px-12 lg:py-10">
        {back}
        <div role="alert" className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-[14px] text-muted">
            {notFound ? 'This book doesn’t exist or was deleted.' : 'Couldn’t load this book.'}
          </p>
          {!notFound && (
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          )}
        </div>
      </main>
    );
  }

  const { book, stats } = data;
  const now = new Date();
  const footer = stats.firstReadAt
    ? `Started ${formatShortDate(stats.firstReadAt, appTimeZone)} · last read ${formatRelativeDay(stats.lastReadAt ?? stats.firstReadAt, now, appTimeZone)}`
    : 'Not started yet';

  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:max-w-[960px] lg:gap-6 lg:px-12 lg:py-10">
      <div className="flex items-center justify-between">
        {back}
        <button
          type="button"
          onClick={() => setEditing(true)}
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
        <StatCard label="Days" value={String(stats.readingDays)} sub="reading days" />
      </section>

      <div className="flex gap-2.5 lg:max-w-[480px]">
        {/* Wired up in milestones 6 (timer) and 5 (manual logging). */}
        <Button className="flex-1" disabled title="Coming with the timer">
          Start reading
        </Button>
        <Button variant="secondary" className="flex-1" disabled title="Coming with manual logging">
          Log session
        </Button>
      </div>

      <BookFormDialog mode="edit" book={book} open={editing} onOpenChange={setEditing} />
    </main>
  );
}
