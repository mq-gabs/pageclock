import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema } from './api';

describe('healthResponseSchema', () => {
  it('accepts an ok status with an ISO timestamp', () => {
    const result = healthResponseSchema.safeParse({ status: 'ok', time: new Date().toISOString() });
    expect(result.success).toBe(true);
  });

  it('rejects other statuses and non-ISO times', () => {
    expect(
      healthResponseSchema.safeParse({ status: 'down', time: new Date().toISOString() }).success,
    ).toBe(false);
    expect(healthResponseSchema.safeParse({ status: 'ok', time: 'yesterday' }).success).toBe(false);
  });
});

describe('apiErrorSchema', () => {
  it('accepts errors with and without field details', () => {
    expect(
      apiErrorSchema.safeParse({ error: { code: 'not_found', message: 'Not found' } }).success,
    ).toBe(true);
    expect(
      apiErrorSchema.safeParse({
        error: {
          code: 'validation_error',
          message: 'Invalid body',
          fields: { title: ['Required'] },
        },
      }).success,
    ).toBe(true);
  });

  it('rejects a body without code', () => {
    expect(apiErrorSchema.safeParse({ error: { message: 'x' } }).success).toBe(false);
  });
});
