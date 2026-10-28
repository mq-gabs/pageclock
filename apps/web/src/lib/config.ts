import { DEFAULT_TIME_ZONE } from '@reading-tracker/shared';

/** Must match the API's APP_TIMEZONE so dates group the same way on both sides. */
export const appTimeZone = process.env.NEXT_PUBLIC_APP_TIMEZONE ?? DEFAULT_TIME_ZONE;
