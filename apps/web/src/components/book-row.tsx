import Link from 'next/link';
import type { BookWithProgress } from '@reading-tracker/shared';
import { appTimeZone } from '@/lib/config';
import { formatBookMeta } from '@/lib/format';
import { cn } from '@/lib/utils';
import { BookCover } from './book-cover';
import { ProgressBar } from './progress-bar';

/** Figma "Book row": cover, title, author, progress and status line; links to the book. */
export function BookRow({ book, className }: { book: BookWithProgress; className?: string }) {
  return (
    <Link
      href={`/books/${book.id}`}
      className={cn(
        'flex items-center gap-3.5 rounded-card border border-border bg-surface p-3 transition-colors hover:border-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <BookCover size="sm" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[15px] font-semibold text-ink">{book.title}</p>
        <p className="truncate text-label text-muted">{book.author}</p>
        <div className="flex items-center gap-2">
          <ProgressBar percent={book.percent} label={`${book.title} progress`} className="flex-1" />
          <span className="text-meta font-medium text-muted">{book.percent}%</span>
        </div>
        <p className="truncate text-meta text-muted">{formatBookMeta(book, appTimeZone)}</p>
      </div>
    </Link>
  );
}
