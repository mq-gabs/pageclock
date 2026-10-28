import { session } from '../test-utils';

export const TZ = 'America/Fortaleza'; // UTC−3, no DST

/**
 * Hand-checked data (local times in America/Fortaleza):
 *
 * | id | local start        | UTC start          | min | paused | pages     |
 * | E  | Wed Sep 30 20:00   | Sep 30 23:00       | 120 |        | 101 → 200 |
 * | D  | Mon Oct 19 21:00   | Oct 20 00:00       |  60 |        |   1 → 50  |
 * | A  | Mon Oct 26 20:00   | Oct 26 23:00       |  60 |        |   1 → 40  |
 * | B  | Tue Oct 27 23:30   | Oct 28 02:30       |  45 |        |  41 → 70  |  ends 00:15 on Oct 28
 * | C  | Wed Oct 28 07:00   | Oct 28 10:00       |  30 | 10 min |  71 → 85  |  20 reading minutes
 * | R  | Wed Oct 28 12:00   | Oct 28 15:00       | running timer, ignored by stats |
 */
export const sessions = [
  session({
    id: 'E',
    bookId: 'b2',
    start: '2026-09-30T23:00:00Z',
    end: '2026-10-01T01:00:00Z',
    startPage: 101,
    endPage: 200,
  }),
  session({
    id: 'D',
    bookId: 'b2',
    start: '2026-10-20T00:00:00Z',
    end: '2026-10-20T01:00:00Z',
    startPage: 1,
    endPage: 50,
  }),
  session({
    id: 'A',
    start: '2026-10-26T23:00:00Z',
    end: '2026-10-27T00:00:00Z',
    startPage: 1,
    endPage: 40,
  }),
  session({
    id: 'B',
    start: '2026-10-28T02:30:00Z',
    end: '2026-10-28T03:15:00Z',
    startPage: 41,
    endPage: 70,
  }),
  session({
    id: 'C',
    start: '2026-10-28T10:00:00Z',
    end: '2026-10-28T10:30:00Z',
    pausedSeconds: 600,
    startPage: 71,
    endPage: 85,
  }),
  session({ id: 'R', start: '2026-10-28T15:00:00Z', end: null, startPage: 86, endPage: null }),
];
