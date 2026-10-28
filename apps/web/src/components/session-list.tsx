import type { Session } from '@reading-tracker/shared';
import { appTimeZone } from '@/lib/config';
import { formatDayLabel, formatSessionDuration, formatSpeed, formatTime } from '@/lib/format';
import { LocalLink } from './app-link';
import { EmptyState } from './states';

const timeRange = (s: Session) =>
  `${formatTime(s.startedAt, appTimeZone)} – ${s.endedAt ? formatTime(s.endedAt, appTimeZone) : 'now'}`;

interface SessionListProps {
  sessions: Session[];
  /** The URL of a session's Edit dialog (for new tabs and reloads). */
  editHref: (session: Session) => string;
  /** Opens that dialog on the current page. */
  onEdit: (session: Session) => void;
}

/** Sessions newest first: Figma rows on mobile, a table with Edit from 1024 px. */
export function SessionList({ sessions, editHref, onEdit }: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <EmptyState title="No sessions yet">
        Log one you’ve already read, or start the timer when you pick the book up.
      </EmptyState>
    );
  }

  return (
    <>
      <ul className="overflow-hidden rounded-card border border-border bg-surface lg:hidden">
        {sessions.map((s) => (
          <li key={s.id} className="border-b border-border last:border-b-0">
            <SessionRow session={s} href={editHref(s)} onEdit={() => onEdit(s)} />
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
                  {s.metrics ? formatSessionDuration(s.metrics.minutes) : 'Reading now'}
                </td>
                <td className="px-4 py-3 font-medium text-ink">
                  p. {s.startPage} → {s.endPage ?? '…'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-accent">
                  {s.metrics ? s.metrics.pages : '—'}
                </td>
                <td className="px-4 py-3 text-right font-medium text-accent">
                  {s.metrics ? formatSpeed(s.metrics.speed) : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  {s.metrics && (
                    <LocalLink
                      href={editHref(s)}
                      onOpen={() => onEdit(s)}
                      className="font-medium text-accent hover:underline"
                    >
                      Edit
                      <span className="sr-only">
                        {' '}
                        session on {formatDayLabel(s.startedAt, appTimeZone)}
                      </span>
                    </LocalLink>
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
function SessionRow({
  session: s,
  href,
  onEdit,
}: {
  session: Session;
  href: string;
  onEdit: () => void;
}) {
  const content = (
    <>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[14px] font-semibold text-ink">
          {formatDayLabel(s.startedAt, appTimeZone)}
        </p>
        <p className="text-meta text-muted">
          {timeRange(s)}
          {s.metrics && ` · ${formatSessionDuration(s.metrics.minutes)}`}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5 font-medium">
        <p className="text-[14px] text-ink">
          p. {s.startPage} → {s.endPage ?? '…'}
        </p>
        <p className="text-meta text-accent">
          {s.metrics ? `${s.metrics.pages} pages · ${formatSpeed(s.metrics.speed)}` : 'Reading now'}
        </p>
      </div>
    </>
  );
  const className = 'flex items-center justify-between gap-3 px-4 py-3';
  return s.metrics ? (
    <LocalLink
      href={href}
      onOpen={onEdit}
      className={`${className} hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring`}
    >
      {content}
      <span className="sr-only">Edit session</span>
    </LocalLink>
  ) : (
    <div className={className}>{content}</div>
  );
}
