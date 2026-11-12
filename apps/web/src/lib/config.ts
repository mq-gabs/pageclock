import { APP_TIME_ZONE } from '@reading-tracker/shared';

/**
 * The device's time zone, used to show and enter dates and times. Falls back to UTC (the zone
 * the API groups stats by) if the browser doesn't report one. Data loads on the client, so
 * dates never render on the server, where this would be the server's zone.
 */
export function displayTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || APP_TIME_ZONE;
  } catch {
    return APP_TIME_ZONE;
  }
}
