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
