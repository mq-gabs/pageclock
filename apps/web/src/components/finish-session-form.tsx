'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  readingSpeed,
  sessionMinutes,
  timerEndedAt,
  type ApiWarning,
  type SaveSessionResponse,
  type Timer,
  type WarningSuggestion,
} from '@reading-tracker/shared';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ApiRequestError, ApiWarningsError } from '@/lib/api';
import { appTimeZone } from '@/lib/config';
import { formatSessionDuration, formatSpeed, formatTime } from '@/lib/format';
import {
  checkSession,
  useBook,
  useDiscardTimer,
  useStopTimer,
  useUpdateTimer,
} from '@/lib/queries';
import { useNow } from '@/lib/use-now';
import { Field } from './field';
import { PageCheckBanner } from './page-check-banner';
import { StatCard } from './stat-card';

function makeSchema(startPage: number, totalPages: number) {
  return z.object({
    endPage: z
      .number({ error: 'Enter the page you stopped on' })
      .int('Use a whole page number')
      .min(startPage, `You started on page ${startPage}`)
      .max(totalPages, `The book has ${totalPages} pages`),
  });
}
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/** Only page fixes apply here; the timer's start and end times aren't editable. */
const pageWarnings = (warnings: ApiWarning[]): ApiWarning[] =>
  warnings.map((w) =>
    w.suggestion?.startPage !== undefined || w.suggestion?.endPage !== undefined
      ? w
      : { ...w, suggestion: undefined },
  );

interface FinishSessionFormProps {
  timer: Timer;
  /** Back to the timer without saving. */
  onCancel: () => void;
  onDiscarded: () => void;
  onSaved: (result: SaveSessionResponse) => void;
}

/** Figma "Finish session": end page, then pages, time and speed for the stopped timer. */
export function FinishSessionForm({
  timer,
  onCancel,
  onDiscarded,
  onSaved,
}: FinishSessionFormProps) {
  const { session, book } = timer;
  const [discarding, setDiscarding] = useState(false);
  const schema = useMemo(
    () => makeSchema(session.startPage, book.totalPages),
    [session.startPage, book.totalPages],
  );
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { errors } = form.formState;
  const endPage = useWatch({ control: form.control, name: 'endPage' });
  const stop = useStopTimer();
  const updateTimer = useUpdateTimer();
  const bookStats = useBook(book.id).data?.stats;

  // Stop pauses the timer, so the end is fixed; if it still runs, it ends now.
  const paused = session.pausedAt !== null;
  const now = useNow(!paused);
  const startedAt = new Date(session.startedAt);
  const endedAt = timerEndedAt(
    { startedAt, pausedAt: session.pausedAt ? new Date(session.pausedAt) : null, pausedSeconds: 0 },
    now,
  );
  const minutes = sessionMinutes({ startedAt, endedAt, pausedSeconds: session.pausedSeconds });
  const parsed = schema.safeParse({ endPage });
  const pages = parsed.success ? parsed.data.endPage - session.startPage + 1 : null;
  const speed = pages === null ? null : readingSpeed(pages, minutes);

  // Rule 3: check the pages live, as the Log session form does.
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const checkRun = useRef(0);
  const validEndPage = parsed.success ? parsed.data.endPage : null;
  const endedAtIso = endedAt.toISOString();
  useEffect(() => {
    if (validEndPage === null) return;
    const run = ++checkRun.current;
    const delay = setTimeout(() => {
      checkSession({
        id: session.id,
        bookId: book.id,
        startedAt: session.startedAt,
        endedAt: endedAtIso,
        startPage: session.startPage,
        endPage: validEndPage,
      })
        .then((result) => {
          if (run === checkRun.current) setWarnings(pageWarnings(result.warnings));
        })
        // Advisory only: stopping runs the same checks on the server.
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(delay);
    // Re-check when the pages change, not on every tick of a running clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id, session.id, session.startedAt, session.startPage, validEndPage, paused]);

  const submit = (confirmWarnings: boolean) =>
    form.handleSubmit(async (data) => {
      try {
        onSaved(
          await stop.mutateAsync({
            endPage: data.endPage,
            confirmWarnings: confirmWarnings || undefined,
          }),
        );
      } catch (error) {
        if (error instanceof ApiWarningsError) {
          setWarnings(pageWarnings(error.warnings));
          return;
        }
        if (!(error instanceof ApiRequestError)) throw error;
        const endPageError = error.fields.endPage?.[0];
        if (endPageError) form.setError('endPage', { message: endPageError });
        else {
          const first = Object.values(error.fields)[0]?.[0];
          form.setError('root', { message: first ?? error.message });
        }
      }
    });

  const applySuggestion = (suggestion: WarningSuggestion) => {
    if (suggestion.endPage !== undefined) {
      form.setValue('endPage', suggestion.endPage, { shouldValidate: true, shouldDirty: true });
    }
    if (suggestion.startPage !== undefined) updateTimer.mutate({ startPage: suggestion.startPage });
  };

  if (discarding) {
    return (
      <DiscardPrompt
        timer={timer}
        minutes={minutes}
        onCancel={() => setDiscarding(false)}
        onDiscarded={onDiscarded}
      />
    );
  }

  const average = bookStats?.speed ?? null;
  const speedSub =
    speed !== null && average !== null
      ? `${speed >= average ? '+' : '−'}${Math.abs(Math.round(speed - average))} vs avg`
      : 'pages/hour';

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-section font-bold text-ink">Finish session</DialogTitle>
        <DialogDescription className="text-[14px] text-muted">
          {book.title} · {formatTime(session.startedAt, appTimeZone)} –{' '}
          {formatTime(endedAt.toISOString(), appTimeZone)}
        </DialogDescription>
      </div>

      <div className="flex flex-col gap-3">
        <Field
          label="Stopped on page"
          type="number"
          inputMode="numeric"
          autoFocus
          min={session.startPage}
          max={book.totalPages}
          error={errors.endPage?.message}
          helper={`Started on page ${session.startPage}. Book has ${book.totalPages} pages.`}
          {...form.register('endPage', { valueAsNumber: true })}
        />
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard
            label="Pages"
            value={pages === null ? '—' : String(pages)}
            sub={`${session.startPage} → ${parsed.success ? parsed.data.endPage : '…'}`}
          />
          <StatCard label="Time" value={formatSessionDuration(minutes)} sub="active" />
          <StatCard label="Speed" value={formatSpeed(speed)} sub={speedSub} />
        </div>
      </div>

      <PageCheckBanner
        warnings={parsed.success ? warnings : []}
        onApply={applySuggestion}
        onSaveAnyway={submit(true)}
        saving={stop.isPending}
      />

      {(errors.root ?? updateTimer.error) && (
        <p role="alert" className="text-meta text-destructive">
          {errors.root?.message ?? updateTimer.error?.message}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2 lg:-mt-0.5 lg:pt-0">
        <div className="flex gap-2.5 lg:justify-end lg:gap-3">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 lg:flex-none"
            onClick={() => setDiscarding(true)}
          >
            Discard
          </Button>
          <Button type="submit" className="flex-1 lg:flex-none" disabled={stop.isPending}>
            Save session
          </Button>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="self-center rounded-button px-3 py-2 text-[14px] font-medium text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
        >
          Back to the timer
        </button>
      </div>
    </form>
  );
}

function DiscardPrompt({
  timer,
  minutes,
  onCancel,
  onDiscarded,
}: {
  timer: Timer;
  minutes: number;
  onCancel: () => void;
  onDiscarded: () => void;
}) {
  const discard = useDiscardTimer();
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-section-sm font-bold text-ink">
          Discard this session?
        </DialogTitle>
        <DialogDescription className="text-[14px] text-muted">
          {formatSessionDuration(minutes)} of reading “{timer.book.title}” won’t be saved. It can’t
          be undone.
        </DialogDescription>
      </div>
      {discard.error && (
        <p role="alert" className="text-meta text-destructive">
          {discard.error.message}
        </p>
      )}
      <div className="mt-auto flex gap-2.5 lg:mt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Keep session
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          disabled={discard.isPending}
          onClick={() =>
            // mutateAsync: clearing the timer unmounts this form before mutate() callbacks run.
            discard.mutateAsync(timer.session.id).then(onDiscarded, () => undefined)
          }
        >
          Discard
        </Button>
      </div>
    </div>
  );
}
