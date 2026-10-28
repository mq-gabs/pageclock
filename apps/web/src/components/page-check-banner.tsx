import { AlertTriangle } from 'lucide-react';
import type { ApiWarning, WarningSuggestion } from '@reading-tracker/shared';
import { appTimeZone } from '@/lib/config';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export function suggestionLabel(suggestion: WarningSuggestion): string | null {
  if (suggestion.startPage !== undefined) return `Start at page ${suggestion.startPage}`;
  if (suggestion.endPage !== undefined) return `End at page ${suggestion.endPage}`;
  if (suggestion.startedAt) return `Start at ${formatTime(suggestion.startedAt, appTimeZone)}`;
  if (suggestion.endedAt) return `End at ${formatTime(suggestion.endedAt, appTimeZone)}`;
  return null;
}

interface PageCheckBannerProps {
  warnings: ApiWarning[];
  onApply: (suggestion: WarningSuggestion) => void;
  onSaveAnyway: () => void;
  saving?: boolean;
  className?: string;
}

const actionClass =
  'rounded-button border border-warning bg-surface px-3 py-2 text-label font-semibold text-warning hover:bg-warning-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning disabled:opacity-50';

/** Rule 3/4 page-check warnings, each with its fix, plus "Save anyway". */
export function PageCheckBanner({
  warnings,
  onApply,
  onSaveAnyway,
  saving,
  className,
}: PageCheckBannerProps) {
  if (warnings.length === 0) return null;
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-button border border-warning bg-warning-tint p-3.5 text-warning',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle aria-hidden size={18} className="shrink-0" />
        <p className="text-[14px] font-semibold">Check the pages</p>
      </div>
      <ul className="flex flex-col gap-2">
        {warnings.map((warning, i) => {
          const { suggestion } = warning;
          const label = suggestion ? suggestionLabel(suggestion) : null;
          return (
            <li key={`${warning.code}-${i}`} className="flex flex-col items-start gap-2">
              <p className="text-label">{warning.message}</p>
              {label && suggestion && (
                <button type="button" className={actionClass} onClick={() => onApply(suggestion)}>
                  {label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className={cn(actionClass, 'self-start')}
        onClick={onSaveAnyway}
        disabled={saving}
      >
        Save anyway
      </button>
    </div>
  );
}
