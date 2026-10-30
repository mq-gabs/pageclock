import request from 'supertest';
import type { createApp } from '../app';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import { issueToken } from '../services/auth';
import { hashPasswordSync } from '../services/password';

/** Inserts an account straight into the database; its password is `password123`. */
export function createTestUser(db: Db, values: { name?: string; nick?: string } = {}) {
  return db
    .insert(users)
    .values({
      name: values.name ?? 'Test Reader',
      nick: values.nick ?? `reader_${crypto.randomUUID().slice(0, 8)}`,
      passwordHash: hashPasswordSync('password123'),
    })
    .returning()
    .get();
}

/**
 * Supertest requests signed in as `userId` (one new token, sent on every request). Each call
 * builds its own request, so a request can be created while another is still in flight.
 */
export function authedAgent(app: ReturnType<typeof createApp>, db: Db, userId: string) {
  const authorization = `Bearer ${issueToken(db, userId)}`;
  return {
    get: (url: string) => request(app).get(url).set('Authorization', authorization),
    post: (url: string) => request(app).post(url).set('Authorization', authorization),
    put: (url: string) => request(app).put(url).set('Authorization', authorization),
    patch: (url: string) => request(app).patch(url).set('Authorization', authorization),
    delete: (url: string) => request(app).delete(url).set('Authorization', authorization),
  };
}
