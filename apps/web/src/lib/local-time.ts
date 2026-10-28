import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

/** A form's date and time fields in the app's time zone. */
export interface LocalParts {
  /** yyyy-MM-dd */
  date: string;
  /** HH:mm */
  time: string;
}

export function toLocalParts(instant: Date | string, timeZone: string): LocalParts {
  const local = new TZDate(new Date(instant).getTime(), timeZone);
  return { date: format(local, 'yyyy-MM-dd'), time: format(local, 'HH:mm') };
}

export function fromLocalParts({ date, time }: LocalParts, timeZone: string): Date {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number);
  const [h = 0, min = 0] = time.split(':').map(Number);
  return new Date(new TZDate(y, m - 1, d, h, min, timeZone).getTime());
}

/**
 * The form has one date and two times. An end time at or before the start time means the
 * session went past midnight, so it ends on the next day.
 */
export function rangeFromForm(
  fields: { date: string; startTime: string; endTime: string },
  timeZone: string,
): { startedAt: Date; endedAt: Date } {
  const startedAt = fromLocalParts({ date: fields.date, time: fields.startTime }, timeZone);
  let endedAt = fromLocalParts({ date: fields.date, time: fields.endTime }, timeZone);
  if (endedAt <= startedAt) endedAt = new Date(endedAt.getTime() + 86_400_000);
  return { startedAt, endedAt };
}
