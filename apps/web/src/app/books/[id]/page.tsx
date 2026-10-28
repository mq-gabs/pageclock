'use client';

import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { BookView } from '@/components/book-view';
import { BookPageSkeleton } from '@/components/skeletons';

/** The Book page; `/books/[id]/log` renders the same page with the Log session dialog open. */
export default function BookPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <Suspense fallback={<BookPageSkeleton />}>
      <BookView id={id} />
    </Suspense>
  );
}
