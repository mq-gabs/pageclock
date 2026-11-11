/**
 * The difference between the server clock and the device clock, estimated from the `Date`
 * header of API responses, so timer clicks are stamped in server time even when the device
 * clock is wrong (rule 5a).
 */
let offsetMs = 0;

/**
 * Updates the estimate from a response's `Date` header. The header has whole seconds, so the
 * server time is taken as the middle of that second, and the device time as the middle of the
 * request.
 */
export function noteServerDate(header: string | null, sentAt: number, receivedAt: number) {
  if (!header) return;
  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return;
  offsetMs = serverMs + 500 - (sentAt + receivedAt) / 2;
}

/** "Now" on the server's clock, as well as the device can tell. */
export const serverNow = (): Date => new Date(Date.now() + offsetMs);

export const serverClockOffsetMs = () => offsetMs;

/** For tests. */
export function resetServerClock() {
  offsetMs = 0;
}
