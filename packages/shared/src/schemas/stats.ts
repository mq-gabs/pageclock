import { z } from 'zod';

export const statsPeriods = ['week', 'month', 'year'] as const;
export const statsPeriodSchema = z.enum(statsPeriods);
export type StatsPeriod = z.infer<typeof statsPeriodSchema>;

/** A calendar date in APP_TIMEZONE, `yyyy-MM-dd`. */
export type DateKey = string;

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date as yyyy-MM-dd')
  .refine((value) => {
    const [y = 0, m = 0, d = 0] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  }, 'Not a real calendar date');

/** The longest range `GET /api/stats/daily` serves: a leap year. */
export const MAX_DAILY_RANGE_DAYS = 366;

const keyToMs = (key: string) => {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

/** `?period=&date=`; `date` defaults to today in APP_TIMEZONE. */
export const statsSummaryQuerySchema = z.object({
  period: statsPeriodSchema,
  date: dateKeySchema.optional(),
});
export type StatsSummaryQuery = z.infer<typeof statsSummaryQuerySchema>;

/** `?from=&to=`, inclusive local dates. */
export const statsDailyQuerySchema = z
  .object({ from: dateKeySchema, to: dateKeySchema })
  .refine((q) => q.from <= q.to, { path: ['to'], message: '`to` must not be before `from`' })
  .refine((q) => (keyToMs(q.to) - keyToMs(q.from)) / 86_400_000 < MAX_DAILY_RANGE_DAYS, {
    path: ['to'],
    message: `Ask for at most ${MAX_DAILY_RANGE_DAYS} days`,
  });
export type StatsDailyQuery = z.infer<typeof statsDailyQuerySchema>;

const dateKey = z.string();

export const periodTotalsSchema = z.object({
  from: dateKey,
  to: dateKey,
  pages: z.int(),
  minutes: z.number(),
  sessions: z.int(),
  /** Pages per hour; null without reading time. */
  speed: z.number().nullable(),
  readingDays: z.int(),
  /** Books with at least one completed session in the period. */
  books: z.int(),
});

export const statsSummaryResponseSchema = z.object({
  period: statsPeriodSchema,
  /** Today in APP_TIMEZONE. */
  today: dateKey,
  current: periodTotalsSchema,
  previous: periodTotalsSchema,
  /** Days of the current period up to today. */
  daysSoFar: z.int(),
  /** Whole-percent change vs the previous period; null when there is nothing to compare. */
  change: z.object({
    pages: z.int().nullable(),
    minutes: z.int().nullable(),
    readingDays: z.int().nullable(),
    speed: z.int().nullable(),
    books: z.int().nullable(),
  }),
});
export type StatsSummaryResponse = z.infer<typeof statsSummaryResponseSchema>;

export const dailyBookStatSchema = z.object({
  bookId: z.string(),
  title: z.string(),
  pages: z.int(),
  minutes: z.number(),
});

export const dailyStatSchema = z.object({
  date: dateKey,
  pages: z.int(),
  minutes: z.number(),
  sessions: z.int(),
  /** The books read that day, most pages first. */
  books: z.array(dailyBookStatSchema),
});

export const statsDailyResponseSchema = z.object({ days: z.array(dailyStatSchema) });
export type StatsDailyResponse = z.infer<typeof statsDailyResponseSchema>;

export const statsStreaksResponseSchema = z.object({
  today: dateKey,
  current: z.int(),
  currentSince: dateKey.nullable(),
  longest: z.int(),
  longestFrom: dateKey.nullable(),
  longestTo: dateKey.nullable(),
  lastReadingDay: dateKey.nullable(),
});
export type StatsStreaksResponse = z.infer<typeof statsStreaksResponseSchema>;
