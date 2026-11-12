'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { timerElapsedSeconds, type LocalTimer } from '@reading-tracker/shared';
import { Button } from '@/components/ui/button';
import { displayTimeZone } from '@/lib/config';
import { formatBookMeta, formatClock, formatShortDate, formatTime } from '@/lib/format';
import { useBooks, useTimer, useTimerActions } from '@/lib/queries';
import { useTimerQueue } from '@/lib/timer-queue';
import { useLocalDialog } from '@/lib/use-local-dialog';
import { serverNow } from '@/lib/server-clock';
import { useNow } from '@/lib/use-now';
import { useStartReading } from '@/lib/use-start-reading';
import { AppLink } from './app-link';
import { BookCover } from './book-cover';
import { Field } from './field';
import { FinishSessionDialog } from './finish-session-dialog';
import { BookRowsSkeleton, TimerSkeleton } from './skeletons';
import { EmptyState, ErrorState } from './states';

/**
 * The Read screen, for both `/read` and `/read/finish`. Finish session is a local dialog:
 * Stop only pushes its URL, so it shows at once.
 */
export function TimerView() {
  const pathname = usePathname();
  const dialog = useLocalDialog('/read');
  return (
    <>
      <TimerScreen onStop={() => dialog.open('/read/finish')} />
      <FinishSessionDialog open={pathname === '/read/finish'} onClose={dialog.close} />
    </>
  );
}

/** The running timer, or a book picker to start one. */
function TimerScreen({ onStop }: { onStop: () => void }) {
  const { data: timer, isPending, isError, refetch } = useTimer();

  if (isPending) return <TimerSkeleton />;
  if (isError) {
    return (
      <ErrorState
        message="Couldn’t load the timer."
        onRetry={() => refetch()}
        className="px-5 py-16"
      />
    );
  }
  return timer ? (
    <RunningTimer key={timer.session.id} timer={timer} onStop={onStop} />
  ) : (
    <StartPicker />
  );
}

/** Figma "Timer": elapsed time, start page, Pause and Stop (a centered 560 px card on desktop). */
function RunningTimer({ timer, onStop }: { timer: LocalTimer; onStop: () => void }) {
  const { session, book, previous } = timer;
  const paused = session.pausedAt !== null;
  const now = useNow(!paused, 250, serverNow);
  const actions = useTimerActions();
  const { pending } = useTimerQueue();
  const elapsed = timerElapsedSeconds(
    {
      startedAt: new Date(session.startedAt),
      pausedAt: session.pausedAt ? new Date(session.pausedAt) : null,
      pausedSeconds: session.pausedSeconds,
    },
    now,
  );

  // Stop asks for the end page right away and pauses the timer, so the end is fixed at the
  // click (a paused timer ends when it was paused) whenever the pause reaches the API.
  const stop = () => {
    if (!paused) actions.pause(session.id);
    onStop();
  };

  return (
    <main className="flex min-h-[calc(100dvh-4rem)] flex-col px-5 pt-6 pb-6 lg:min-h-screen lg:items-center lg:justify-center lg:p-10">
      <div className="flex flex-1 flex-col lg:w-[560px] lg:flex-none lg:rounded-card lg:border lg:border-border lg:bg-surface lg:p-10">
        <header className="flex flex-col gap-1 lg:items-center lg:text-center">
          <p className="text-meta font-semibold text-muted uppercase">Reading now</p>
          <h1 className="text-[20px] font-bold text-ink lg:text-section-sm">
            <AppLink href={`/books/${book.id}`} className="hover:underline">
              {book.title}
            </AppLink>
          </h1>
        </header>

        <div className="mt-5 flex flex-col items-center gap-2 rounded-card border border-border bg-surface py-7 lg:mt-5 lg:gap-4 lg:border-0 lg:py-0">
          <p
            role="timer"
            aria-label={`Elapsed ${formatClock(elapsed)}`}
            className="text-[56px] font-bold text-ink tabular-nums lg:text-[88px]"
          >
            {formatClock(elapsed)}
          </p>
          <p className="text-[14px] text-muted lg:text-[15px]">
            {paused ? 'Paused' : 'Running'} · started at{' '}
            {formatTime(session.startedAt, displayTimeZone())}
          </p>
          {pending > 0 && (
            <p role="status" className="text-meta text-muted">
              Syncing…
            </p>
          )}
        </div>

        <StartPageField key={session.startPage} timer={timer} previous={previous} />

        <div className="mt-auto grid grid-cols-2 gap-2.5 pt-6 lg:mt-2 lg:gap-3 lg:pt-0">
          <Button
            variant="secondary"
            onClick={() => (paused ? actions.resume(session.id) : actions.pause(session.id))}
          >
            {paused ? 'Resume' : 'Pause'}
          </Button>
          <Button onClick={stop}>Stop</Button>
        </div>
      </div>
    </main>
  );
}

/**
 * Rule 1's start page, editable while the timer runs; saved when the field loses focus. Until
 * the API has the Start, rule 1's page is unknown and the field shows "…".
 */
function StartPageField({
  timer,
  previous,
}: {
  timer: LocalTimer;
  previous: LocalTimer['previous'];
}) {
  const { session, book } = timer;
  const actions = useTimerActions();
  const [value, setValue] = useState(session.startPage === null ? '' : String(session.startPage));
  const [error, setError] = useState<string>();

  if (session.startPage === null) {
    return (
      <div className="mt-6 flex flex-col gap-1.5 lg:mt-5">
        <Field label="Start page" value="" placeholder="…" disabled readOnly />
        <p className="text-meta text-muted">Filled in once the server has your session.</p>
      </div>
    );
  }

  const commit = () => {
    const page = Number(value);
    if (value.trim() === '' || !Number.isInteger(page)) return setError('Enter the start page');
    if (page < 1) return setError('Start page must be at least 1');
    if (page > book.totalPages) return setError(`The book has ${book.totalPages} pages`);
    setError(undefined);
    if (page === session.startPage) return;
    actions.setStartPage(session.id, page);
  };

  const action = (
    <>
      <span className="lg:hidden">Tap</span>
      <span className="hidden lg:inline">Click</span> to change.
    </>
  );
  let helper: React.ReactNode = null;
  if (previous && session.startPage === Math.min(previous.endPage + 1, book.totalPages)) {
    helper = (
      <>
        Filled in from the page after your last session ended (
        {formatShortDate(previous.startedAt, displayTimeZone())}). {action}
      </>
    );
  } else if (previous) {
    helper = `Your last session ended on page ${previous.endPage}.`;
  } else if (session.startPage === 1) {
    helper = <>First session of this book. {action}</>;
  }

  return (
    <div className="mt-6 flex flex-col gap-1.5 lg:mt-5">
      <Field
        label="Start page"
        type="number"
        inputMode="numeric"
        min={1}
        max={book.totalPages}
        value={value}
        error={error}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {!error && helper && <p className="text-meta text-muted">{helper}</p>}
    </div>
  );
}

/** No timer running: pick a book to start one. */
function StartPicker() {
  const { data, isPending, isError, refetch } = useBooks({});
  const start = useStartReading();

  // Books being read first, then the want-to-read list; finished books can't be re-read yet.
  const books = (data?.books ?? [])
    .filter((b) => b.status !== 'finished')
    .sort((a, b) => Number(b.status === 'reading') - Number(a.status === 'reading'));

  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:max-w-[960px] lg:gap-6 lg:px-12 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-sm font-bold text-ink lg:text-title">Read</h1>
        <p className="text-[14px] text-muted">Pick a book to start the timer.</p>
      </div>

      {isPending ? (
        <BookRowsSkeleton count={3} className="lg:grid-cols-2" />
      ) : isError ? (
        <ErrorState message="Couldn’t load your books." onRetry={() => refetch()} />
      ) : books.length === 0 ? (
        <EmptyState
          title="Nothing to read yet"
          action={
            <Button asChild variant="secondary" size="sm">
              <AppLink href="/library">Go to the library</AppLink>
            </Button>
          }
        >
          Add a book to your library, or move a finished one back to Reading.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-4">
          {books.map((book) => (
            <li
              key={book.id}
              className="flex items-center gap-3.5 rounded-card border border-border bg-surface p-3"
            >
              <BookCover size="sm" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-[15px] font-semibold text-ink">{book.title}</p>
                <p className="truncate text-label text-muted">{book.author}</p>
                <p className="truncate text-meta text-muted">{formatBookMeta(book, displayTimeZone())}</p>
              </div>
              <Button
                size="compact"
                className="px-4"
                disabled={start.disabled}
                aria-label={`Start reading ${book.title}`}
                onClick={() => start.start(book)}
              >
                Start
              </Button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
