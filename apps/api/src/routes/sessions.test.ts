import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  bookDetailSchema,
  listBooksResponseSchema,
  listSessionsResponseSchema,
  saveSessionResponseSchema,
  sessionCheckResponseSchema,
  sessionWarningsResponseSchema,
} from '@reading-tracker/shared';
import { createApp } from '../app';
import type { Db } from '../db/client';
import { readingSessions } from '../db/schema';
import { seed } from '../db/seed';
import { createTestDb } from '../test/db';

let db: Db;
let app: ReturnType<typeof createApp>;
const now = Date.now();
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString();
// A slot earlier today with no seeded session in it.
const slot = { startedAt: minutesAgo(90), endedAt: minutesAgo(60) };
const missingId = '00000000-0000-4000-8000-000000000000';

beforeEach(() => {
  db = createTestDb();
  seed(db, new Date(now), 'America/Fortaleza');
  app = createApp({ db });
});

async function bookId(title: string) {
  const { books } = listBooksResponseSchema.parse((await request(app).get('/api/books')).body);
  return books.find((b) => b.title === title)!.id;
}
const sessionsOf = async (id: string) =>
  listSessionsResponseSchema.parse((await request(app).get(`/api/books/${id}/sessions`)).body)
    .sessions;
const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;

describe('the milestone 5 flow: previous session ends on page 174', () => {
  it('warns about the gap, suggests 175, and saves with confirmWarnings', async () => {
    const id = await bookId('Project Hail Mary');
    const body = { bookId: id, ...slot, startPage: 181, endPage: 200 };

    const check = sessionCheckResponseSchema.parse(
      (await request(app).post('/api/reading-sessions/check').send(body)).body,
    );
    expect(check.errors).toEqual([]);
    expect(check.suggestedStartPage).toBe(175);
    expect(check.warnings).toEqual([
      expect.objectContaining({ code: 'page_gap_before', suggestion: { startPage: 175 } }),
    ]);
    expect(check.warnings[0]!.message).toContain('Pages 175–180 are skipped');

    const conflict = await request(app).post('/api/reading-sessions').send(body);
    expect(conflict.status).toBe(409);
    expect(sessionWarningsResponseSchema.parse(conflict.body).warnings[0]!.code).toBe(
      'page_gap_before',
    );
    expect(await sessionsOf(id)).toHaveLength(7); // nothing saved

    const saved = await request(app)
      .post('/api/reading-sessions')
      .send({ ...body, confirmWarnings: true });
    expect(saved.status).toBe(201);
    expect(saveSessionResponseSchema.parse(saved.body).book.progress).toBe(200);
  });

  it('saves without warnings when starting at the suggested page', async () => {
    const id = await bookId('Project Hail Mary');
    const res = await request(app)
      .post('/api/reading-sessions')
      .send({ bookId: id, ...slot, startPage: 175, endPage: 190 });
    expect(res.status).toBe(201);
    const saved = saveSessionResponseSchema.parse(res.body);
    expect(saved.session).toMatchObject({ source: 'manual', startPage: 175, endPage: 190 });
    expect(saved.session.metrics).toEqual({ pages: 16, minutes: 30, speed: 32 });
    expect(saved.book).toMatchObject({ progress: 190, percent: 40, status: 'reading' });
    expect(saved.offerFinish).toBe(false);
  });

  it('moves a want_to_read book to reading on its first session', async () => {
    const id = await bookId('Piranesi');
    const res = await request(app)
      .post('/api/reading-sessions')
      .send({ bookId: id, ...slot, startPage: 1, endPage: 20 });
    expect(res.status).toBe(201);
    expect(saveSessionResponseSchema.parse(res.body).book.status).toBe('reading');
    const { books } = listBooksResponseSchema.parse((await request(app).get('/api/books')).body);
    expect(books[0]!.title).toBe('Piranesi'); // most recently updated first
  });

  it('offers to finish when the session reaches the last page', async () => {
    const id = await bookId('Project Hail Mary');
    const res = await request(app)
      .post('/api/reading-sessions')
      .send({ bookId: id, ...slot, startPage: 175, endPage: 476 });
    const saved = saveSessionResponseSchema.parse(res.body);
    expect(saved.offerFinish).toBe(true);
    expect(saved.book.status).toBe('reading'); // finishing stays the user's choice
  });
});

describe('POST /api/reading-sessions: hard rules', () => {
  it.each([
    [
      'end before start',
      { startedAt: minutesAgo(60), endedAt: minutesAgo(90), startPage: 175, endPage: 190 },
      'endedAt',
    ],
    [
      'end in the future',
      {
        startedAt: minutesAgo(10),
        endedAt: new Date(now + 3_600_000).toISOString(),
        startPage: 175,
        endPage: 190,
      },
      'endedAt',
    ],
    [
      'longer than 12 hours',
      { startedAt: minutesAgo(13 * 60), endedAt: minutesAgo(10), startPage: 175, endPage: 190 },
      'endedAt',
    ],
    ['end page before start', { ...slot, startPage: 175, endPage: 174 }, 'endPage'],
    ['end page above the total', { ...slot, startPage: 175, endPage: 477 }, 'endPage'],
    ['start page below 1', { ...slot, startPage: 0, endPage: 10 }, 'startPage'],
  ])('rejects %s with 400', async (_name, fields, field) => {
    const res = await request(app)
      .post('/api/reading-sessions')
      .send({ bookId: await bookId('Project Hail Mary'), ...fields });
    expect(res.status).toBe(400);
    const error = errorOf(res.body);
    expect(error.code).toBe('validation_error');
    expect(error.fields?.[field]).toBeDefined();
  });

  it('blocks hard errors even with confirmWarnings', async () => {
    const res = await request(app)
      .post('/api/reading-sessions')
      .send({
        bookId: await bookId('Project Hail Mary'),
        ...slot,
        startPage: 181,
        endPage: 900,
        confirmWarnings: true,
      });
    expect(res.status).toBe(400);
  });

  it('rejects malformed bodies', async () => {
    const id = await bookId('Project Hail Mary');
    expect((await request(app).post('/api/reading-sessions').send({})).status).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/reading-sessions')
          .send({ bookId: id, ...slot, startPage: 1.5, endPage: 10 })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/reading-sessions')
          .send({ bookId: id, startedAt: 'today', endedAt: slot.endedAt, startPage: 1, endPage: 1 })
      ).status,
    ).toBe(400);
  });

  it('returns 404 for an unknown book', async () => {
    const res = await request(app)
      .post('/api/reading-sessions')
      .send({ bookId: missingId, ...slot, startPage: 1, endPage: 10 });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/reading-sessions/check', () => {
  it('reports errors without saving', async () => {
    const id = await bookId('Project Hail Mary');
    const res = await request(app)
      .post('/api/reading-sessions/check')
      .send({ bookId: id, ...slot, startPage: 175, endPage: 900 });
    expect(res.status).toBe(200);
    expect(sessionCheckResponseSchema.parse(res.body).errors.map((e) => e.code)).toEqual([
      'end_page_above_total',
    ]);
    expect(await sessionsOf(id)).toHaveLength(7);
  });

  it('warns about a time overlap with another book', async () => {
    const thinking = await sessionsOf(await bookId('Thinking, Fast and Slow'));
    const latest = thinking[0]!; // newest first
    const res = await request(app)
      .post('/api/reading-sessions/check')
      .send({
        bookId: await bookId('Piranesi'),
        startedAt: latest.startedAt,
        endedAt: latest.endedAt,
        startPage: 1,
        endPage: 10,
      });
    const { warnings } = sessionCheckResponseSchema.parse(res.body);
    expect(warnings).toEqual([
      expect.objectContaining({ code: 'time_overlap', sessionId: latest.id }),
    ]);
  });

  it('ignores the session being edited', async () => {
    const id = await bookId('Project Hail Mary');
    const [latest] = await sessionsOf(id);
    const res = await request(app).post('/api/reading-sessions/check').send({
      id: latest!.id,
      bookId: id,
      startedAt: latest!.startedAt,
      endedAt: latest!.endedAt,
      startPage: 163,
      endPage: 174,
    });
    expect(sessionCheckResponseSchema.parse(res.body)).toMatchObject({
      errors: [],
      warnings: [],
      suggestedStartPage: 163,
    });
  });

  it('rejects a malformed body', async () => {
    expect(
      (await request(app).post('/api/reading-sessions/check').send({ bookId: 'x' })).status,
    ).toBe(400);
  });
});

describe('PATCH /api/reading-sessions/:id', () => {
  it('edits a session', async () => {
    const id = await bookId('Project Hail Mary');
    const [latest] = await sessionsOf(id);
    const res = await request(app)
      .patch(`/api/reading-sessions/${latest!.id}`)
      .send({ endPage: 180 });
    expect(res.status).toBe(200);
    expect(saveSessionResponseSchema.parse(res.body)).toMatchObject({
      session: { endPage: 180 },
      book: { progress: 180 },
    });
  });

  it('returns 409 when the edit creates a gap, and saves once confirmed', async () => {
    const id = await bookId('Project Hail Mary');
    const sessions = await sessionsOf(id);
    const middle = sessions[3]!;
    const conflict = await request(app)
      .patch(`/api/reading-sessions/${middle.id}`)
      .send({ endPage: middle.endPage! - 5 });
    expect(conflict.status).toBe(409);
    expect(sessionWarningsResponseSchema.parse(conflict.body).warnings[0]!.code).toBe(
      'page_gap_after',
    );
    const ok = await request(app)
      .patch(`/api/reading-sessions/${middle.id}`)
      .send({ endPage: middle.endPage! - 5, confirmWarnings: true });
    expect(ok.status).toBe(200);
  });

  it('applies the hard rules to the merged session', async () => {
    const [latest] = await sessionsOf(await bookId('Project Hail Mary'));
    const res = await request(app)
      .patch(`/api/reading-sessions/${latest!.id}`)
      .send({ startPage: 200 });
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.endPage).toBeDefined();
  });

  it('refuses to edit a running timer', async () => {
    const row = db
      .insert(readingSessions)
      .values({
        bookId: await bookId('Piranesi'),
        startedAt: new Date(now - 60_000),
        startPage: 1,
        source: 'timer',
      })
      .returning()
      .get();
    const res = await request(app).patch(`/api/reading-sessions/${row.id}`).send({ startPage: 1 });
    expect(res.status).toBe(409);
    expect(errorOf(res.body).code).toBe('session_running');
  });

  it('returns 404 / 400 for unknown or malformed ids and bodies', async () => {
    expect(
      (await request(app).patch(`/api/reading-sessions/${missingId}`).send({ endPage: 1 })).status,
    ).toBe(404);
    expect(
      (await request(app).patch('/api/reading-sessions/nope').send({ endPage: 1 })).status,
    ).toBe(400);
    const [latest] = await sessionsOf(await bookId('Project Hail Mary'));
    expect(
      (await request(app).patch(`/api/reading-sessions/${latest!.id}`).send({ endPage: 'ten' }))
        .status,
    ).toBe(400);
  });
});

describe('DELETE /api/reading-sessions/:id', () => {
  it('deletes a session and lowers the progress', async () => {
    const id = await bookId('Project Hail Mary');
    const [latest] = await sessionsOf(id);
    expect((await request(app).delete(`/api/reading-sessions/${latest!.id}`)).status).toBe(204);
    const { book } = bookDetailSchema.parse((await request(app).get(`/api/books/${id}`)).body);
    expect(book.progress).toBe(162);
  });

  it('returns 404 / 400 for unknown or malformed ids', async () => {
    expect((await request(app).delete(`/api/reading-sessions/${missingId}`)).status).toBe(404);
    expect((await request(app).delete('/api/reading-sessions/nope')).status).toBe(400);
  });
});

describe('GET /api/books/:id/sessions', () => {
  it('lists the book’s sessions newest first with metrics', async () => {
    const sessions = await sessionsOf(await bookId('Project Hail Mary'));
    expect(sessions).toHaveLength(7);
    expect(sessions[0]).toMatchObject({
      startPage: 163,
      endPage: 174,
      metrics: { pages: 12, minutes: 20 },
    });
    const starts = sessions.map((s) => s.startedAt);
    expect([...starts].sort().reverse()).toEqual(starts);
  });

  it('is empty for a book without sessions and 404 for an unknown book', async () => {
    expect(await sessionsOf(await bookId('Piranesi'))).toEqual([]);
    expect((await request(app).get(`/api/books/${missingId}/sessions`)).status).toBe(404);
  });
});

describe('GET /api/books/:id/suggested-start-page', () => {
  it('uses the latest session before `at`, defaulting to now', async () => {
    const id = await bookId('Project Hail Mary');
    expect((await request(app).get(`/api/books/${id}/suggested-start-page`)).body).toEqual({
      startPage: 175,
    });
    const longAgo = new Date(now - 60 * 86_400_000).toISOString();
    expect(
      (await request(app).get(`/api/books/${id}/suggested-start-page?at=${longAgo}`)).body,
    ).toEqual({ startPage: 1 });
  });

  it('rejects a malformed `at` and an unknown book', async () => {
    const id = await bookId('Project Hail Mary');
    expect(
      (await request(app).get(`/api/books/${id}/suggested-start-page?at=yesterday`)).status,
    ).toBe(400);
    expect((await request(app).get(`/api/books/${missingId}/suggested-start-page`)).status).toBe(
      404,
    );
  });
});
