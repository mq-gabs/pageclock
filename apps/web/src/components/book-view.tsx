'use client';

import { useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { bookStatusLabels } from '@reading-tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ApiRequestError } from '@/lib/api';
import { appTimeZone } from '@/lib/config';
import { formatDuration, formatRelativeDay, formatShortDate, formatSpeed } from '@/lib/format';
import { useBook, useBookSessions, useTimer } from '@/lib/queries';
import { useLocalDialog } from '@/lib/use-local-dialog';
import { useStartReading } from '@/lib/use-start-reading';
import { AppLink, LocalLink } from './app-link';
import { BookCover } from './book-cover';
import { BookFormDialog } from './book-form-dialog';
import { StatusChip } from './chip';
import { LogSessionForm } from './log-session-form';
import { ProgressBar } from './progress-bar';
import { SessionList } from './session-list';
import { StatCard } from './stat-card';
import { BookSkeleton, DialogFormSkeleton, SessionsSkeleton } from './skeletons';
import { ErrorState } from './states';

const logHref = (bookId: string, sessionId?: string) =>
  sessionId ? `/books/${bookId}/log?session=${sessionId}` : `/books/${bookId}/log`;

/**
 * The Book screen, for both `/books/[id]` and `/books/[id]/log` (`?session=<id>` edits one).
 * Log session is a local dialog: opening it only pushes its URL, so it shows at once.
 */
export function BookView({ id }: { id: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const dialog = useLocalDialog(`/books/${id}`);
  const logOpen = pathname === logHref(id);
  return (
    <>
      <BookScreen id={id} onLog={(sessionId) => dialog.open(logHref(id, sessionId))} />
      <LogSessionDialog
        bookId={id}
        open={logOpen}
        sessionId={logOpen ? params.get('session') : null}
        onClose={dialog.close}
      />
    </>
  );
}

function BookScreen({ id, onLog }: { id: string; onLog: (sessionId?: string) => void }) {
  const { data, isPending, error, refetch } = useBook(id);
  const sessions = useBookSessions(id);
  const [editing, setEditing] = useState(false);
  const timer = useTimer();
  const start = useStartReading();

  const back = (
    <AppLink
      href="/library"
      className="self-start text-[15px] font-medium text-accent hover:underline"
    >
      ‹ Library
    </AppLink>
  );

  if (isPending) {
    return (
      <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:max-w-[960px] lg:gap-6 lg:px-12 lg:py-10">
        {back}
        <BookSkeleton />
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
      {/* React hoists this into <head> ahead of the layout's "Book" title, so the tab shows the
          book while it is loaded and falls back to "Book" otherwise. */}
      <title>{`${book.title} · Pageclock`}</title>
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
            <AppLink href="/read">Open timer</AppLink>
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
          <LocalLink href={logHref(book.id)} onOpen={() => onLog()}>
            Log session
          </LocalLink>
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
          <SessionsSkeleton />
        ) : sessions.isError ? (
          <ErrorState
            message="Couldn’t load sessions."
            onRetry={() => sessions.refetch()}
            className="py-6"
          />
        ) : (
          <SessionList
            sessions={sessions.data.sessions}
            editHref={(s) => logHref(id, s.id)}
            onEdit={(s) => onLog(s.id)}
          />
        )}
      </section>

      <BookFormDialog mode="edit" book={book} open={editing} onOpenChange={setEditing} />
    </main>
  );
}

function LogSessionDialog({
  bookId,
  open,
  sessionId,
  onClose,
}: {
  bookId: string;
  open: boolean;
  sessionId: string | null;
  onClose: () => void;
}) {
  const book = useBook(bookId);
  const sessions = useBookSessions(bookId);
  const session = sessionId ? sessions.data?.sessions.find((s) => s.id === sessionId) : undefined;
  const loading = book.isPending || (sessionId !== null && sessions.isPending);
  const missing =
    book.isError || (sessionId !== null && !loading && (!session || !session.endedAt));

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="lg:w-[560px]" aria-describedby={undefined}>
        {loading ? (
          <>
            <DialogTitle className="sr-only">
              {sessionId ? 'Edit session' : 'Log session'}
            </DialogTitle>
            <DialogFormSkeleton fields={4} />
          </>
        ) : missing || !book.data ? (
          <>
            <DialogTitle className="text-section-sm font-bold text-ink">Not found</DialogTitle>
            <p className="text-[14px] text-muted">This book or session doesn’t exist.</p>
          </>
        ) : (
          <LogSessionForm
            key={session?.id ?? 'new'}
            book={book.data.book}
            session={session}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
