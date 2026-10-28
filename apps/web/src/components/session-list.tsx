import Link from 'next/link';
import type { Session } from '@reading-tracker/shared';
import { appTimeZone } from '@/lib/config';
import { formatDayLabel, formatDuration, formatSpeed, formatTime } from '@/lib/format';

const editHref = (s: Session) => `/books/${s.bookId}/log?session=${s.id}`;
const timeRange = (s: Session) =>
  `${formatTime(s.startedAt, appTimeZone)} – ${s.endedAt ? formatTime(s.endedAt, appTimeZone) : 'now'}`;

/** Sessions newest first: Figma rows on mobile, a table with Edit from 1024 px. */
export function SessionList({ sessions }: { sessions: Session[] }) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-card border border-border bg-surface px-4 py-6 text-center text-[14px] text-muted">
        No sessions yet. Log one or start the timer.
      </p>
    );
  }

  return (
    <>
      <ul className="overflow-hidden rounded-card border border-border bg-surface lg:hidden">
        {sessions.map((s) => (
          <li key={s.id} className="border-b border-border last:border-b-0">
            <SessionRow session={s} />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-hidden rounded-card border border-border bg-surface lg:block">
        <table className="w-full text-left text-[14px]">
          <thead className="border-b border-border text-meta font-medium text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Time
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Duration
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Pages
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Read
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Speed
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-3 font-semibold text-ink">
                  {formatDayLabel(s.startedAt, appTimeZone)}
                </td>
                <td className="px-4 py-3 text-muted">{timeRange(s)}</td>
                <td className="px-4 py-3 text-muted">
                  {s.metrics ? formatDuration(s.metrics.minutes) : 'Reading now'}
                </td>
                <td className="px-4 py-3 font-medium text-ink">
                  p. {s.startPage} → {s.endPage ?? '…'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-accent">
                  {s.metrics ? `+${s.metrics.pages}` : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-accent">
                  {s.metrics ? formatSpeed(s.metrics.speed) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {s.metrics && (
                    <Link href={editHref(s)} className="font-medium text-accent hover:underline">
                      Edit
                      <span className="sr-only">
                        {' '}
                        session on {formatDayLabel(s.startedAt, appTimeZone)}
                      </span>
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Figma "Session" row. Tapping a finished session opens it for editing. */
function SessionRow({ session: s }: { session: Session }) {
  const content = (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[14px] font-semibold text-ink">
          {formatDayLabel(s.startedAt, appTimeZone)}
        </p>
        <p className="text-meta text-muted">
          {timeRange(s)}
          {s.metrics && ` · ${formatDuration(s.metrics.minutes)}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 font-medium">
        <p className="text-[14px] text-ink">
          p. {s.startPage} → {s.endPage ?? '…'}
        </p>
        <p className="text-meta text-accent">
          {s.metrics
            ? `+${s.metrics.pages} pages · ${formatSpeed(s.metrics.speed)}`
            : 'Reading now'}
        </p>
      </div>
    </>
  );
  const className = 'flex items-center justify-between gap-3 px-4 py-3';
  return s.metrics ? (
    <Link
      href={editHref(s)}
      className={`${className} hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      {content}
      <span className="sr-only">Edit session</span>
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}
