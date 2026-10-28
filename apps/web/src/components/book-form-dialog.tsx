'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  bookStatusLabels,
  bookStatuses,
  bookStatusSchema,
  createBookSchema,
  type BookStatus,
  type BookWithProgress,
} from '@reading-tracker/shared';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiRequestError } from '@/lib/api';
import { useCreateBook, useDeleteBook, useUpdateBook } from '@/lib/queries';
import { useAppRouter } from '@/lib/navigation-progress';
import { Chip } from './chip';
import { Field } from './field';

const formSchema = createBookSchema.extend({ status: bookStatusSchema });
type FormInput = z.input<typeof formSchema>;
type FormOutput = z.output<typeof formSchema>;
const formFields = ['title', 'author', 'totalPages', 'status'] as const;

type BookFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & ({ mode: 'create' } | { mode: 'edit'; book: BookWithProgress });

export function BookFormDialog(props: BookFormDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        {/* Remount on every open so the form starts from the book's current values. */}
        {props.open && <BookForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function BookForm(props: BookFormDialogProps) {
  const book = props.mode === 'edit' ? props.book : undefined;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const create = useCreateBook();
  const update = useUpdateBook(book?.id ?? '');

  const form = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: book?.title ?? '',
      author: book?.author ?? '',
      totalPages: book?.totalPages,
      status: book?.status ?? 'want_to_read',
    },
  });
  const { errors, isSubmitting } = form.formState;
  const status = useWatch({ control: form.control, name: 'status' });

  const onSubmit = form.handleSubmit(async ({ status: nextStatus, ...fields }) => {
    try {
      if (book) await update.mutateAsync({ ...fields, status: nextStatus });
      else await create.mutateAsync(fields);
      props.onOpenChange(false);
    } catch (error) {
      if (!(error instanceof ApiRequestError)) throw error;
      let mapped = false;
      for (const field of formFields) {
        const message = error.fields[field]?.[0];
        if (message) {
          form.setError(field, { message });
          mapped = true;
        }
      }
      if (!mapped) form.setError('root', { message: error.message });
    }
  });

  if (book && confirmingDelete) {
    return <DeleteConfirm book={book} onCancel={() => setConfirmingDelete(false)} />;
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-section-sm font-bold text-ink">
          {book ? 'Edit book' : 'Add book'}
        </DialogTitle>
        <DialogDescription className="text-[14px] text-muted">
          {book ? 'Change the details or status.' : 'Title, author and how many pages it has.'}
        </DialogDescription>
      </div>

      <Field
        label="Title"
        autoComplete="off"
        error={errors.title?.message}
        {...form.register('title')}
      />
      <Field
        label="Author"
        autoComplete="off"
        error={errors.author?.message}
        {...form.register('author')}
      />
      <Field
        label="Total pages"
        type="number"
        inputMode="numeric"
        min={1}
        error={errors.totalPages?.message}
        {...form.register('totalPages', { valueAsNumber: true })}
      />

      {book && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-label font-medium text-muted">Status</legend>
          <div className="flex flex-wrap gap-2">
            {bookStatuses.map((value: BookStatus) => (
              <Chip
                key={value}
                active={status === value}
                onClick={() => form.setValue('status', value, { shouldDirty: true })}
              >
                {bookStatusLabels[value]}
              </Chip>
            ))}
          </div>
        </fieldset>
      )}

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
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {book ? 'Save' : 'Add book'}
          </Button>
        </div>
        {book && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="self-center rounded-button px-3 py-2 text-[14px] font-medium text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Delete book
          </button>
        )}
      </div>
    </form>
  );
}

function DeleteConfirm({ book, onCancel }: { book: BookWithProgress; onCancel: () => void }) {
  const router = useAppRouter();
  const remove = useDeleteBook(book.id);
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex flex-col gap-1">
        <DialogTitle className="text-section-sm font-bold text-ink">
          Delete “{book.title}”?
        </DialogTitle>
        <DialogDescription className="text-[14px] text-muted">
          This also deletes all of its reading sessions. It can’t be undone.
        </DialogDescription>
      </div>
      {remove.error && (
        <p role="alert" className="text-meta text-destructive">
          {remove.error.message}
        </p>
      )}
      <div className="mt-auto flex gap-2.5 lg:mt-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>
          Keep book
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          disabled={remove.isPending}
          onClick={() => remove.mutate(undefined, { onSuccess: () => router.push('/library') })}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
