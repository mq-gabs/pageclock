'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { SaveSessionResponse } from '@reading-tracker/shared';
import { FinishSessionForm } from '@/components/finish-session-form';
import { FinishPrompt } from '@/components/log-session-form';
import { TimerView } from '@/components/timer-view';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useTimer } from '@/lib/queries';

/** Finish session: full screen on mobile, a 480 px dialog over the timer on desktop. */
export default function FinishSessionPage() {
  const router = useRouter();
  const timer = useTimer();
  // Once saved the timer is gone, so the result drives the rest of the flow.
  const [saved, setSaved] = useState<SaveSessionResponse>();
  const toTimer = () => router.push('/read');
  const toBook = (bookId: string) => router.push(`/books/${bookId}`);

  let content: React.ReactNode;
  if (saved) {
    content = saved.offerFinish ? (
      <FinishPrompt book={saved.book} onClose={() => toBook(saved.book.id)} />
    ) : (
      <>
        <DialogTitle className="sr-only">Session saved</DialogTitle>
        <p className="py-10 text-center text-[14px] text-muted">Session saved.</p>
      </>
    );
  } else if (timer.isPending) {
    content = (
      <>
        <DialogTitle className="sr-only">Finish session</DialogTitle>
        <p className="py-10 text-center text-[14px] text-muted">Loading…</p>
      </>
    );
  } else if (!timer.data) {
    content = (
      <>
        <DialogTitle className="text-section-sm font-bold text-ink">No timer running</DialogTitle>
        <p className="text-[14px] text-muted">
          {timer.isError ? 'Couldn’t load the timer. ' : 'There is no session to finish. '}
          <Link href="/read" className="font-medium text-accent hover:underline">
            Go to Read
          </Link>
        </p>
      </>
    );
  } else {
    content = (
      <FinishSessionForm
        timer={timer.data}
        onCancel={toTimer}
        onDiscarded={toTimer}
        onSaved={(result) => {
          setSaved(result);
          if (!result.offerFinish) toBook(result.book.id);
        }}
      />
    );
  }

  return (
    <>
      <div className="hidden lg:block" aria-hidden>
        <TimerView />
      </div>
      <Dialog open onOpenChange={(open) => !open && (saved ? toBook(saved.book.id) : toTimer())}>
        <DialogContent aria-describedby={undefined}>{content}</DialogContent>
      </Dialog>
    </>
  );
}
