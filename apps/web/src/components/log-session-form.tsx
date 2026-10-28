'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  dateKeySchema,
  type ApiWarning,
  type BookWithProgress,
  type Session,
  type WarningSuggestion,
} from '@reading-tracker/shared';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { DialogClose, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ApiRequestError, ApiWarningsError } from '@/lib/api';
import { appTimeZone } from '@/lib/config';
import { formatSessionDuration } from '@/lib/format';
import { rangeFromForm, toLocalParts } from '@/lib/local-time';
import {
  checkSession,
  fetchSuggestedStartPage,
  useDeleteSession,
  useSaveSession,
  useUpdateBook,
} from '@/lib/queries';
import { Field } from './field';
import { PageCheckBanner } from './page-check-banner';

const time = (message: string) => z.string().regex(/^\d{2}:\d{2}$/, message);
const pageNumber = (message: string) => z.number({ error: message }).int('Use a whole page number');

function makeSchema(totalPages: number) {
  return z
    .object({
      date: dateKeySchema,
      startTime: time('Enter a start time'),
      endTime: time('Enter an end time'),
      startPage: pageNumber('Enter the start page')
        .min(1, 'Start page must be at least 1')
        .max(totalPages, `The book has ${totalPages} pages`),
      endPage: pageNumber('Enter the end page').max(totalPages, `The book has ${totalPages} pages`),
    })
    .refine((v) => v.endPage >= v.startPage, {
      path: ['endPage'],
      message: 'End page can’t be before the start page',
    });
}
type FormValues = z.infer<ReturnType<typeof makeSchema>>;

/** API fields → form fields, for 400 responses. */
const serverFieldMap: Record<string, keyof FormValues> = {
  startedAt: 'startTime',
  endedAt: 'endTime',
  startPage: 'startPage',
  endPage: 'endPage',
};

function defaultValues(book: BookWithProgress, session?: Session): Partial<FormValues> {
  if (session?.endedAt && session.endPage !== null) {
    const start = toLocalParts(session.startedAt, appTimeZone);
    return {
      date: start.date,
      startTime: start.time,
      endTime: toLocalParts(session.endedAt, appTimeZone).time,
      startPage: session.startPage,
      endPage: session.endPage,
    };
  }
  // New log: the last 30 minutes, ending now (rounded down to 5 minutes).
  const end = new Date(Math.floor(Date.now() / 300_000) * 300_000);
  const start = toLocalParts(new Date(end.getTime() - 30 * 60_000), appTimeZone);
  return {
    date: start.date,
    startTime: start.time,
    endTime: toLocalParts(end, appTimeZone).time,
    startPage: Math.min(book.progress + 1, book.totalPages),
  };
}

interface LogSessionFormProps {
  book: BookWithProgress;
  /** The session to edit; omit to log a new one. */
  session?: Session;
  onClose: () => void;
}

export function LogSessionForm({ book, session, onClose }: LogSessionFormProps) {
  const [stage, setStage] = useState<'form' | 'finish' | 'delete'>('form');
  if (stage === 'finish') return <FinishPrompt book={book} onClose={onClose} />;
  if (stage === 'delete' && session) {
    return <DeletePrompt session={session} onCancel={() => setStage('form')} onDeleted={onClose} />;
  }
  return (
    <SessionForm
      book={book}
      session={session}
      onClose={onClose}
      onFinishOffer={() => setStage('finish')}
      onDelete={() => setStage('delete')}
    />
  );
}

function SessionForm({
  book,
  session,
  onClose,
  onFinishOffer,
  onDelete,
}: LogSessionFormProps & { onFinishOffer: () => void; onDelete: () => void }) {
  const schema = useMemo(() => makeSchema(book.totalPages), [book.totalPages]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues(book, session),
  });
  const { errors } = form.formState;
  const values = useWatch({ control: form.control });
  // Effects below key on the field values, not on the object identity.
  const valuesKey = JSON.stringify(values);
  const save = useSaveSession();

  // Rule 1: keep the start page in sync with the date and start time until the user edits it.
  const [startPageEdited, setStartPageEdited] = useState(Boolean(session));
  useEffect(() => {
    if (startPageEdited || !values.date || !values.startTime) return;
    const parsed = dateKeySchema.safeParse(values.date);
    if (!parsed.success) return;
    let cancelled = false;
    const { startedAt } = rangeFromForm(
      { date: values.date, startTime: values.startTime, endTime: values.startTime },
      appTimeZone,
    );
    fetchSuggestedStartPage(book.id, startedAt)
      .then(({ startPage }) => {
        if (!cancelled) form.setValue('startPage', startPage);
      })
      // Advisory only: if it fails, the user can still type the start page.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [book.id, form, startPageEdited, values.date, values.startTime]);

  // Rule 3: check the pages live, once the fields are valid.
  const [warnings, setWarnings] = useState<ApiWarning[]>([]);
  const checkRun = useRef(0);
  useEffect(() => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) return;
    const run = ++checkRun.current;
    const timer = setTimeout(() => {
      const { startedAt, endedAt } = rangeFromForm(parsed.data, appTimeZone);
      checkSession({
        id: session?.id,
        bookId: book.id,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        startPage: parsed.data.startPage,
        endPage: parsed.data.endPage,
      })
        .then((result) => {
          if (run === checkRun.current) setWarnings(result.warnings);
        })
        // Advisory only: saving runs the same checks on the server.
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `values` is captured via valuesKey
  }, [book.id, schema, session?.id, valuesKey]);

  const submit = (confirmWarnings: boolean) =>
    form.handleSubmit(async (data) => {
      const { startedAt, endedAt } = rangeFromForm(data, appTimeZone);
      const input = {
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        startPage: data.startPage,
        endPage: data.endPage,
        confirmWarnings: confirmWarnings || undefined,
      };
      try {
        const result = await save.mutateAsync(
          session
            ? { mode: 'edit', sessionId: session.id, input }
            : { mode: 'create', input: { ...input, bookId: book.id } },
        );
        if (result.offerFinish) onFinishOffer();
        else onClose();
      } catch (error) {
        if (error instanceof ApiWarningsError) {
          setWarnings(error.warnings);
          return;
        }
        if (!(error instanceof ApiRequestError)) throw error;
        let mapped = false;
        for (const [apiField, messages] of Object.entries(error.fields)) {
          const field = serverFieldMap[apiField];
          if (field && messages[0]) {
            form.setError(field, { message: messages[0] });
            mapped = true;
          }
        }
        if (!mapped) form.setError('root', { message: error.message });
      }
    });

  const applySuggestion = (suggestion: WarningSuggestion) => {
    const opts = { shouldValidate: true, shouldDirty: true };
    if (suggestion.startPage !== undefined) {
      setStartPageEdited(true);
      form.setValue('startPage', suggestion.startPage, opts);
    }
    if (suggestion.endPage !== undefined) form.setValue('endPage', suggestion.endPage, opts);
    if (suggestion.startedAt) {
      const start = toLocalParts(suggestion.startedAt, appTimeZone);
      form.setValue('date', start.date, opts);
      form.setValue('startTime', start.time, opts);
    }
    if (suggestion.endedAt) {
      form.setValue('endTime', toLocalParts(suggestion.endedAt, appTimeZone).time, opts);
    }
  };

  const valid = schema.safeParse(values).success;
  const summary = (() => {
    const parsed = schema.safeParse(values);
    if (!parsed.success) return null;
    const { startedAt, endedAt } = rangeFromForm(parsed.data, appTimeZone);
    const minutes = (endedAt.getTime() - startedAt.getTime()) / 60_000;
    return `${parsed.data.endPage - parsed.data.startPage + 1} pages · ${formatSessionDuration(minutes)}`;
  })();

  return (
    <form onSubmit={submit(false)} noValidate className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-section-sm font-bold text-ink">
          {session ? 'Edit session' : 'Log session'}
        </DialogTitle>
        <DialogDescription className="text-[14px] text-muted">
          {book.title} · {book.totalPages} pages
        </DialogDescription>
      </div>

      <Field label="Date" type="date" error={errors.date?.message} {...form.register('date')} />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Start time"
          type="time"
          error={errors.startTime?.message}
          {...form.register('startTime')}
        />
        <Field
          label="End time"
          type="time"
          error={errors.endTime?.message}
          helper={
            values.endTime && values.startTime && values.endTime <= values.startTime
              ? 'Ends the next day'
              : undefined
          }
          {...form.register('endTime')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Start page"
          type="number"
          inputMode="numeric"
          min={1}
          max={book.totalPages}
          error={errors.startPage?.message}
          helper={startPageEdited ? undefined : 'After where your last session ended'}
          {...form.register('startPage', {
            valueAsNumber: true,
            onChange: () => setStartPageEdited(true),
          })}
        />
        <Field
          label="End page"
          type="number"
          inputMode="numeric"
          min={1}
          max={book.totalPages}
          error={errors.endPage?.message}
          helper={summary ?? `of ${book.totalPages}`}
          {...form.register('endPage', { valueAsNumber: true })}
        />
      </div>

      <PageCheckBanner
        warnings={valid ? warnings : []}
        onApply={applySuggestion}
        onSaveAnyway={submit(true)}
        saving={save.isPending}
      />

      {errors.root && (
        <p role="alert" className="text-meta text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2 lg:mt-2">
        <div className="flex gap-2.5">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="flex-1">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" className="flex-1" disabled={save.isPending}>
            Save
          </Button>
        </div>
        {session && (
          <button
            type="button"
            onClick={onDelete}
            className="self-center rounded-button px-3 py-2 text-[14px] font-medium text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Delete session
          </button>
        )}
      </div>
    </form>
  );
}

/** Rule 6: offered when a saved session reaches the book's last page. */
export function FinishPrompt({ book, onClose }: { book: BookWithProgress; onClose: () => void }) {
  const update = useUpdateBook(book.id);
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-section-sm font-bold text-ink">
          You reached the last page
        </DialogTitle>
        <DialogDescription className="text-[14px] text-muted">
          Mark “{book.title}” as finished?
        </DialogDescription>
      </div>
      {update.error && (
        <p role="alert" className="text-meta text-destructive">
          {update.error.message}
        </p>
      )}
      <div className="mt-auto flex gap-2.5 lg:mt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
          Not now
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={update.isPending}
          onClick={() => update.mutate({ status: 'finished' }, { onSuccess: onClose })}
        >
          Mark as finished
        </Button>
      </div>
    </div>
  );
}

function DeletePrompt({
  session,
  onCancel,
  onDeleted,
}: {
  session: Session;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const remove = useDeleteSession();
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-section-sm font-bold text-ink">
          Delete this session?
        </DialogTitle>
        <DialogDescription className="text-[14px] text-muted">
          Pages {session.startPage} → {session.endPage} will no longer count. It can’t be undone.
        </DialogDescription>
      </div>
      {remove.error && (
        <p role="alert" className="text-meta text-destructive">
          {remove.error.message}
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
          disabled={remove.isPending}
          onClick={() => remove.mutate(session.id, { onSuccess: onDeleted })}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
