/**
 * The difference between the server clock and the device clock, estimated from the `Date`
 * header of API responses, so timer clicks are stamped in server time even when the device
 * clock is wrong (rule 5a). Timer displays read the same clock (`serverNow`), so a pause
 * freezes on the second that was showing and a resume continues from it.
 *
 * Each response bounds the offset: the server wrote the header during the second it names
 * (whole seconds only) and between sending and receiving on the device. Intersecting those
 * bounds narrows the estimate over time instead of jumping with every response.
 */
let low = -Infinity;
let high = Infinity;

export function noteServerDate(header: string | null, sentAt: number, receivedAt: number) {
  if (!header) return;
  const serverMs = Date.parse(header);
  if (Number.isNaN(serverMs)) return;
  const sampleLow = serverMs - receivedAt;
  const sampleHigh = serverMs + 1000 - sentAt;
  if (Math.max(low, sampleLow) > Math.min(high, sampleHigh)) {
    // Doesn't fit what we knew: the device clock was changed. Start over from this response.
    low = sampleLow;
    high = sampleHigh;
  } else {
    low = Math.max(low, sampleLow);
    high = Math.min(high, sampleHigh);
  }
}

export const serverClockOffsetMs = () => (Number.isFinite(low) ? (low + high) / 2 : 0);

/** "Now" on the server's clock, as well as the device can tell. */
export const serverNow = (): Date => new Date(Date.now() + serverClockOffsetMs());

/** For tests. */
export function resetServerClock() {
  low = -Infinity;
  high = Infinity;
}
