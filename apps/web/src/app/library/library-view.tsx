'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { bookStatusSchema, type BookCounts, type BookStatus } from '@reading-tracker/shared';
import { BookFormDialog } from '@/components/book-form-dialog';
import { BookRow } from '@/components/book-row';
import { Chip } from '@/components/chip';
import { SearchInput } from '@/components/search-input';
import { BookRowsSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { useBooks } from '@/lib/queries';
import { cn } from '@/lib/utils';

const filters: { value: BookStatus | undefined; label: string; key: keyof BookCounts }[] = [
  { value: undefined, label: 'All', key: 'all' },
  { value: 'reading', label: 'Reading', key: 'reading' },
  { value: 'want_to_read', label: 'Want to read', key: 'want_to_read' },
  { value: 'finished', label: 'Finished', key: 'finished' },
];

/** Library: filters and search live in the URL (`?status=&q=`) so they survive reloads. */
export function LibraryView() {
  const pathname = usePathname();
  const params = useSearchParams();
  const parsedStatus = bookStatusSchema.safeParse(params.get('status'));
  const status = parsedStatus.success ? parsedStatus.data : undefined;
  const q = params.get('q') ?? '';

  const [search, setSearch] = useState(q);
  const [adding, setAdding] = useState(false);
  const { data, isPending, isError, refetch } = useBooks({ status, q: q.trim() || undefined });

  // Builds on the live URL, not on this render's values, so a debounced search can't
  // overwrite a filter chosen in the meantime. `replaceState` updates `useSearchParams`
  // without a server round trip, so filters apply at once.
  const setParams = (next: { status?: BookStatus; q?: string }) => {
    const merged = new URLSearchParams(window.location.search);
    if ('status' in next) {
      if (next.status) merged.set('status', next.status);
      else merged.delete('status');
    }
    if ('q' in next) {
      const nextQ = next.q?.trim();
      if (nextQ) merged.set('q', nextQ);
      else merged.delete('q');
    }
    window.history.replaceState(null, '', merged.size ? `${pathname}?${merged}` : pathname);
  };

  // Debounce typing into the URL.
  useEffect(() => {
    if (search.trim() === q.trim()) return;
    const timer = setTimeout(() => setParams({ q: search }), 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [search]);

  const counts = data?.counts;
  const books = data?.books ?? [];
  const searchProps = {
    value: search,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value),
    placeholder: 'Search title or author',
    'aria-label': 'Search title or author',
  };

  return (
    <main className="flex flex-col gap-4 px-5 pt-6 pb-5 lg:gap-6 lg:px-12 lg:py-10">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title-sm font-bold text-ink lg:text-title">Library</h1>
          {counts && (
            <p className="hidden text-[14px] text-muted lg:block">
              {counts.all} {counts.all === 1 ? 'book' : 'books'} · {counts.reading} reading
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <SearchInput {...searchProps} className="hidden h-[46px] w-80 lg:flex" />
          <Button
            variant="secondary"
            size="sm"
            className="lg:hidden"
            onClick={() => setAdding(true)}
          >
            + Add book
          </Button>
          <Button className="hidden lg:inline-flex" onClick={() => setAdding(true)}>
            + Add book
          </Button>
        </div>
      </header>

      <SearchInput {...searchProps} className="h-11 lg:hidden" />

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {filters.map(({ value, label, key }) => (
          <Chip key={key} active={status === value} onClick={() => setParams({ status: value })}>
            {label}
            {counts && (
              // Figma shows the count on "All" only on mobile, on every chip on desktop.
              <span className={cn(key !== 'all' && 'hidden lg:inline')}> · {counts[key]}</span>
            )}
          </Chip>
        ))}
      </div>

      {isPending ? (
        <BookRowsSkeleton count={6} />
      ) : isError ? (
        <ErrorState message="Couldn’t load your library." onRetry={() => refetch()} />
      ) : books.length === 0 ? (
        counts?.all === 0 && !q ? (
          <EmptyState
            title="Your library is empty"
            action={<Button onClick={() => setAdding(true)}>+ Add your first book</Button>}
          >
            Add a book you’re reading or want to read, then log sessions or start the timer.
          </EmptyState>
        ) : (
          <EmptyState
            title="No books match"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setParams({ status: undefined, q: '' });
                }}
              >
                Clear search and filters
              </Button>
            }
          >
            {q ? `Nothing matches “${q}”` : 'Nothing here'}
            {status ? ` in ${filters.find((f) => f.value === status)?.label}.` : '.'}
          </EmptyState>
        )
      ) : (
        <ul className="flex flex-col gap-2.5 lg:grid lg:grid-cols-3 lg:gap-4">
          {books.map((book) => (
            <li key={book.id}>
              <BookRow book={book} className="h-full" />
            </li>
          ))}
        </ul>
      )}

      <BookFormDialog mode="create" open={adding} onOpenChange={setAdding} />
    </main>
  );
}
