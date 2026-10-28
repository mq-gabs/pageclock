import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';
import {
  bookStatusLabels,
  daysBetween,
  toDateKey,
  type BookWithProgress,
} from '@reading-tracker/shared';

/** 41 → "41 min", 224 → "3h 44m", 120 → "2h". */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Pages per hour, rounded: "38 p/h"; "—" without reading time. */
export function formatSpeed(speed: number | null): string {
  return speed === null ? '—' : `${Math.round(speed)} p/h`;
}

/** "Oct 12" in the app's time zone. */
export function formatShortDate(iso: string, timeZone: string): string {
  return format(new TZDate(new Date(iso).getTime(), timeZone), 'MMM d');
}

/** "today", "yesterday", "3 days ago", or "Oct 12" after a week. */
export function formatRelativeDay(iso: string, now: Date, timeZone: string): string {
  const days = daysBetween(toDateKey(new Date(iso), timeZone), toDateKey(now, timeZone));
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatShortDate(iso, timeZone);
}

/** The status line under a book: "Reading · p. 142 of 320", "Finished · Oct 12", "Want to read · 688 pages". */
export function formatBookMeta(book: BookWithProgress, timeZone: string): string {
  const status = bookStatusLabels[book.status];
  if (book.status === 'finished') {
    return book.finishedAt ? `${status} · ${formatShortDate(book.finishedAt, timeZone)}` : status;
  }
  if (book.progress > 0) return `${status} · p. ${book.progress} of ${book.totalPages}`;
  return `${status} · ${book.totalPages} pages`;
}

/** "Mon, Oct 27" in the app's time zone. */
export function formatDayLabel(iso: string, timeZone: string): string {
  return format(new TZDate(new Date(iso).getTime(), timeZone), 'EEE, MMM d');
}

/** "20:10" in the app's time zone. */
export function formatTime(iso: string, timeZone: string): string {
  return format(new TZDate(new Date(iso).getTime(), timeZone), 'HH:mm');
}
