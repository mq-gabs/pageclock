'use client';

import { Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BookView } from '@/components/book-view';
import { LogSessionForm } from '@/components/log-session-form';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useBook, useBookSessions } from '@/lib/queries';

/** Log session (`?session=<id>` edits one): full screen on mobile, a 560 px dialog over the Book page on desktop. */
export default function LogSessionPage() {
  return (
    <Suspense>
      <LogSessionRoute />
    </Suspense>
  );
}

function LogSessionRoute() {
  const { id } = useParams<{ id: string }>();
  const sessionId = useSearchParams().get('session');
  const router = useRouter();
  const book = useBook(id);
  const sessions = useBookSessions(id);
  const close = () => router.push(`/books/${id}`);

  const session = sessionId ? sessions.data?.sessions.find((s) => s.id === sessionId) : undefined;
  const loading = book.isPending || (sessionId !== null && sessions.isPending);
  const missing =
    book.isError || (sessionId !== null && !loading && (!session || !session.endedAt));

  return (
    <>
      <div className="hidden lg:block" aria-hidden>
        <BookView id={id} />
      </div>
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent className="lg:w-[560px]" aria-describedby={undefined}>
          {loading ? (
            <>
              <DialogTitle className="sr-only">Log session</DialogTitle>
              <p className="py-10 text-center text-[14px] text-muted">Loading…</p>
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
              onClose={close}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
