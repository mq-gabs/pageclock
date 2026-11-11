import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  backupSchema,
  importBackupResponseSchema,
  listBooksResponseSchema,
  type Backup,
} from '@reading-tracker/shared';
import { createApp } from '../app';
import type { Db } from '../db/client';
import { seed } from '../db/seed';
import { authedAgent, createTestUser } from '../test/auth';
import { startTimerBody } from '../test/timer';
import { createTestDb } from '../test/db';

const now = new Date('2026-10-28T15:00:00Z');
let db: Db;
let app: ReturnType<typeof createApp>;
let demo: ReturnType<typeof authedAgent>;
let other: ReturnType<typeof authedAgent>;

beforeEach(() => {
  db = createTestDb();
  const { userId } = seed(db, now, 'America/Fortaleza');
  app = createApp({ db, timeZone: 'America/Fortaleza' });
  demo = authedAgent(app, db, userId);
  other = authedAgent(app, db, createTestUser(db).id);
});

const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;
const exportOf = async (agent: ReturnType<typeof authedAgent>) =>
  backupSchema.parse((await agent.get('/api/backup')).body);
const booksOf = async (agent: ReturnType<typeof authedAgent>) =>
  listBooksResponseSchema.parse((await agent.get('/api/books')).body).books;

const minimal = (fields: Partial<Backup> = {}) => ({
  format: 'pageclock-backup',
  version: 1,
  books: [{ id: 'b1', title: 'Dune', author: 'Frank Herbert', totalPages: 400 }],
  sessions: [
    {
      bookId: 'b1',
      startedAt: '2026-10-27T10:00:00Z',
      endedAt: '2026-10-27T11:00:00Z',
      startPage: 1,
      endPage: 30,
    },
  ],
  ...fields,
});

describe('GET /api/backup', () => {
  it('needs a signed-in user', async () => {
    const res = await request(app).get('/api/backup');
    expect(res.status).toBe(401);
  });

  it('exports the user’s books and finished sessions', async () => {
    const res = await demo.get('/api/backup');
    expect(res.status).toBe(200);
    const backup = backupSchema.parse(res.body);
    expect(backup).toMatchObject({ format: 'pageclock-backup', version: 1 });
    expect(backup.books).toHaveLength(5);
    expect(backup.sessions.length).toBeGreaterThan(0);
    const ids = new Set(backup.books.map((b) => b.id));
    expect(backup.sessions.every((s) => ids.has(s.bookId))).toBe(true);
  });

  it('leaves out a running timer', async () => {
    const before = (await exportOf(demo)).sessions.length;
    const piranesi = (await booksOf(demo)).find((b) => b.title === 'Piranesi')!;
    expect((await demo.post('/api/timer/start').send(startTimerBody(piranesi.id))).status).toBe(
      201,
    );
    expect((await exportOf(demo)).sessions).toHaveLength(before);
  });

  it('exports nothing of another user', async () => {
    expect(await exportOf(other)).toMatchObject({ books: [], sessions: [] });
  });
});

describe('POST /api/backup', () => {
  it('restores a backup into another account with the same progress', async () => {
    const backup = await exportOf(demo);
    const res = await other.post('/api/backup').send(backup);
    expect(res.status).toBe(200);
    expect(importBackupResponseSchema.parse(res.body)).toEqual({
      books: { added: 5, matched: 0 },
      sessions: { added: backup.sessions.length, skipped: 0 },
    });

    const summary = (books: Awaited<ReturnType<typeof booksOf>>) =>
      books.map(({ title, status, progress, finishedAt }) => ({
        title,
        status,
        progress,
        finishedAt,
      }));
    expect(summary(await booksOf(other))).toEqual(summary(await booksOf(demo)));
    // The demo account is untouched.
    expect(await booksOf(demo)).toHaveLength(5);
  });

  it('adds nothing when the same backup is imported twice', async () => {
    const backup = await exportOf(demo);
    const res = await demo.post('/api/backup').send(backup);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      books: { added: 0, matched: 5 },
      sessions: { added: 0, skipped: backup.sessions.length },
    });
    expect(await booksOf(demo)).toHaveLength(5);
  });

  it('adds new sessions to a book already in the library', async () => {
    const res = await other.post('/api/backup').send(minimal());
    expect(res.body).toEqual({
      books: { added: 1, matched: 0 },
      sessions: { added: 1, skipped: 0 },
    });
    const more = minimal({
      sessions: [
        {
          bookId: 'b1',
          startedAt: '2026-10-28T10:00:00Z',
          endedAt: '2026-10-28T11:00:00Z',
          startPage: 31,
          endPage: 60,
          pausedSeconds: 0,
          source: 'timer',
        },
      ],
    });
    const second = await other.post('/api/backup').send(more);
    expect(second.body).toEqual({
      books: { added: 0, matched: 1 },
      sessions: { added: 1, skipped: 0 },
    });
    expect(await booksOf(other)).toEqual([
      expect.objectContaining({ title: 'Dune', progress: 60 }),
    ]);
  });

  it('rejects a file that isn’t a backup', async () => {
    const res = await other.post('/api/backup').send({ books: [] });
    expect(res.status).toBe(400);
    expect(errorOf(res.body)).toMatchObject({
      code: 'validation_error',
      fields: {
        format: ['This isn’t a Pageclock backup file'],
        version: ['This backup version isn’t supported'],
        sessions: [expect.any(String)],
      },
    });
  });

  it('reports invalid books and sessions by their path', async () => {
    const res = await other.post('/api/backup').send(
      minimal({
        books: [
          { id: 'b1', title: '', author: 'Frank Herbert', totalPages: 400 },
        ] as Backup['books'],
      }),
    );
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields).toEqual({ 'books.0.title': ['Enter a title'] });
  });

  it('applies rule 2 to sessions and imports nothing when one fails', async () => {
    const backup = minimal();
    const bad = { ...backup.sessions[0]!, endPage: 401 };
    const res = await other
      .post('/api/backup')
      .send({ ...backup, sessions: [backup.sessions[0], bad] });
    expect(res.status).toBe(400);
    expect(errorOf(res.body)).toMatchObject({
      message: 'The backup has invalid data',
      fields: { 'sessions.1.endPage': [expect.stringContaining('400 pages')] },
    });
    expect(await booksOf(other)).toEqual([]);
  });

  it('rejects invalid JSON', async () => {
    const res = await other
      .post('/api/backup')
      .set('Content-Type', 'application/json')
      .send('{"format":');
    expect(res.status).toBe(400);
    expect(errorOf(res.body).code).toBe('invalid_json');
  });

  it('accepts a backup larger than the default body limit', async () => {
    const sessions = Array.from({ length: 1000 }, (_, i) => ({
      bookId: 'b1',
      startedAt: new Date(Date.UTC(2024, 0, 1) + i * 86_400_000).toISOString(),
      endedAt: new Date(Date.UTC(2024, 0, 1) + i * 86_400_000 + 600_000).toISOString(),
      startPage: 1,
      endPage: 2,
    }));
    const body = minimal({ sessions } as Partial<Backup>);
    expect(JSON.stringify(body).length).toBeGreaterThan(100_000);
    const res = await other.post('/api/backup').send(body);
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual({ added: 1000, skipped: 0 });
  });

  it('answers 413 for a body over 20 MB', async () => {
    const res = await other
      .post('/api/backup')
      .send({ ...minimal(), padding: 'x'.repeat(21 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect(errorOf(res.body).code).toBe('payload_too_large');
  });
});
