import { describe, expect, it } from 'vitest';
import { issuesToFields, validateSession } from './validate-session';

const now = new Date('2026-10-28T15:00:00Z');
const context = { totalPages: 300, now };
const valid = {
  startedAt: new Date('2026-10-28T12:00:00Z'),
  endedAt: new Date('2026-10-28T13:00:00Z'),
  startPage: 10,
  endPage: 40,
};
const codes = (overrides: Partial<typeof valid>, ctx = context) =>
  validateSession({ ...valid, ...overrides }, ctx).map((i) => i.code);

describe('validateSession', () => {
  it('accepts a valid session', () => {
    expect(validateSession(valid, context)).toEqual([]);
  });

  it('requires the end time to be after the start time', () => {
    expect(codes({ endedAt: valid.startedAt })).toEqual(['ended_before_start']);
    expect(codes({ endedAt: new Date('2026-10-28T11:00:00Z') })).toEqual(['ended_before_start']);
  });

  it('rejects an end time in the future but accepts exactly now', () => {
    expect(codes({ endedAt: new Date(now.getTime() + 1) })).toEqual(['ended_in_future']);
    expect(codes({ endedAt: now })).toEqual([]);
  });

  it('allows up to 12 hours', () => {
    const startedAt = new Date('2026-10-28T02:00:00Z');
    expect(codes({ startedAt, endedAt: new Date('2026-10-28T14:00:00Z') })).toEqual([]);
    expect(codes({ startedAt, endedAt: new Date('2026-10-28T14:00:01Z') })).toEqual(['too_long']);
  });

  it('checks page rules', () => {
    expect(codes({ startPage: 0 })).toEqual(['start_page_below_one']);
    expect(codes({ startPage: -1 })).toEqual(['start_page_below_one']);
    expect(codes({ startPage: 1 })).toEqual([]);
    expect(codes({ endPage: 10 })).toEqual([]); // a single page: 10 → 10
    expect(codes({ endPage: 9 })).toEqual(['end_page_before_start']);
    expect(codes({ endPage: 300 })).toEqual([]);
    expect(codes({ endPage: 301 })).toEqual(['end_page_above_total']);
  });

  it('reports every problem at once', () => {
    expect(
      codes({ endedAt: new Date('2026-10-29T00:00:00Z'), startPage: 500, endPage: 400 }).sort(),
    ).toEqual(['end_page_above_total', 'end_page_before_start', 'ended_in_future']);
  });
});

describe('issuesToFields', () => {
  it('groups messages by field', () => {
    const fields = issuesToFields(
      validateSession({ ...valid, startPage: 400, endPage: 350 }, context),
    );
    expect(Object.keys(fields)).toEqual(['endPage']);
    expect(fields.endPage).toHaveLength(2);
  });
});
