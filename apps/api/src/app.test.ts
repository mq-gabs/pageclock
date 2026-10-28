import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { apiErrorSchema, healthResponseSchema } from '@reading-tracker/shared';
import { createApp } from './app';
import { createTestDb } from './test/db';

const app = createApp({ db: createTestDb() });

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body).status).toBe('ok');
  });
});

describe('errors', () => {
  it('returns the error shape for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('not_found');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"oops"');
    expect(res.status).toBe(400);
    expect(apiErrorSchema.parse(res.body).error.code).toBe('invalid_json');
  });
});
