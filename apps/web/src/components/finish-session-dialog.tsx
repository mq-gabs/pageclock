'use client';

import { useState } from 'react';
import type { SaveSessionResponse } from '@reading-tracker/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAppRouter } from '@/lib/navigation-progress';
import { useTimer } from '@/lib/queries';
import { FinishSessionForm } from './finish-session-form';
import { FinishPrompt } from './log-session-form';
import { DialogFormSkeleton } from './skeletons';

/** Finish session: full screen on mobile, a 480 px dialog over the timer on desktop. */
export function FinishSessionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useAppRouter();
  // Once saved the timer is gone, so the result drives the rest of the flow.
  const [saved, setSaved] = useState<SaveSessionResponse>();
  // After saving, the book page replaces /read/finish in history, so Back returns to /read.
  const toBook = (bookId: string) => router.replace(`/books/${bookId}`);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) return;
        if (saved) toBook(saved.book.id);
        else onClose();
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <FinishBody
          saved={saved}
          onSaved={(result) => {
            setSaved(result);
            if (!result.offerFinish) toBook(result.book.id);
          }}
          onClose={() => {
            setSaved(undefined);
            onClose();
          }}
          onDone={(bookId) => toBook(bookId)}
        />
      </DialogContent>
    </Dialog>
  );
}

function FinishBody({
  saved,
  onSaved,
  onClose,
  onDone,
}: {
  saved: SaveSessionResponse | undefined;
  onSaved: (result: SaveSessionResponse) => void;
  onClose: () => void;
  onDone: (bookId: string) => void;
}) {
  const timer = useTimer();

  if (saved) {
    return saved.offerFinish ? (
      <FinishPrompt book={saved.book} onClose={() => onDone(saved.book.id)} />
    ) : (
      <>
        <DialogTitle className="text-section-sm font-bold text-ink">Session saved</DialogTitle>
        <p role="status" className="text-[14px] text-muted">
          Opening {saved.book.title}…
        </p>
      </>
    );
  }
  if (timer.isPending) {
    return (
      <>
        <DialogTitle className="sr-only">Finish session</DialogTitle>
        <DialogFormSkeleton fields={1} />
      </>
    );
  }
  if (!timer.data) {
    return (
      <>
        <DialogTitle className="text-section-sm font-bold text-ink">No timer running</DialogTitle>
        <p className="text-[14px] text-muted">
          {timer.isError ? 'Couldn’t load the timer.' : 'There is no session to finish.'}
        </p>
        <Button type="button" variant="secondary" onClick={onClose}>
          Back to Read
        </Button>
      </>
    );
  }
  return (
    <FinishSessionForm
      timer={timer.data}
      onCancel={onClose}
      onDiscarded={onClose}
      onSaved={onSaved}
    />
  );
}
