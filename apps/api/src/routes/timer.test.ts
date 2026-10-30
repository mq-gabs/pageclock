import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiErrorSchema,
  bookDetailSchema,
  listBooksResponseSchema,
  listSessionsResponseSchema,
  saveSessionResponseSchema,
  sessionWarningsResponseSchema,
  timerResponseSchema,
} from '@reading-tracker/shared';
import { createApp } from '../app';
import type { Db } from '../db/client';
import { seed } from '../db/seed';
import { authedAgent } from '../test/auth';
import { createTestDb } from '../test/db';

let db: Db;
let api: ReturnType<typeof authedAgent>;
let userId: string;
const start = Date.now();
const missingId = '00000000-0000-4000-8000-000000000000';

/** Moves the (faked) clock to `minutes` after the test started. */
const at = (minutes: number) => vi.setSystemTime(start + minutes * 60_000);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: start });
  db = createTestDb();
  userId = seed(db, new Date(start), 'America/Fortaleza').userId;
  api = authedAgent(createApp({ db }), db, userId);
});

afterEach(() => {
  vi.useRealTimers();
});

async function bookId(title: string) {
  const { books } = listBooksResponseSchema.parse((await api.get('/api/books')).body);
  return books.find((b) => b.title === title)!.id;
}
const timerOf = (body: unknown) => timerResponseSchema.parse(body).timer;
const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;
const getTimer = async () => timerOf((await api.get('/api/timer')).body);

describe('the milestone 6 flow', () => {
  it('starts, survives a reload, and stops into a saved session', async () => {
    const id = await bookId('Project Hail Mary');
    expect(await getTimer()).toBeNull();

    const started = await api.post('/api/timer/start').send({ bookId: id });
    expect(started.status).toBe(201);
    const timer = timerOf(started.body)!;
    expect(timer.session).toMatchObject({
      bookId: id,
      startPage: 175, // rule 1: the page after the last session’s end
      endedAt: null,
      endPage: null,
      source: 'timer',
      metrics: null,
    });
    expect(timer.book.title).toBe('Project Hail Mary');
    expect(timer.previous?.endPage).toBe(174);

    // "Reload" on another device: a fresh app and token on the same database still see the timer.
    api = authedAgent(createApp({ db }), db, userId);
    expect((await getTimer())?.session.id).toBe(timer.session.id);

    at(40);
    const stopped = await api.post('/api/timer/stop').send({ endPage: 200 });
    expect(stopped.status).toBe(200);
    const saved = saveSessionResponseSchema.parse(stopped.body);
    expect(saved.session).toMatchObject({ id: timer.session.id, startPage: 175, endPage: 200 });
    expect(saved.session.metrics).toEqual({ pages: 26, minutes: 40, speed: 39 });
    expect(saved.book.progress).toBe(200);
    expect(await getTimer()).toBeNull();

    const { sessions } = listSessionsResponseSchema.parse(
      (await api.get(`/api/books/${id}/sessions`)).body,
    );
    expect(sessions[0]!.id).toBe(timer.session.id);
  });

  it('refuses a second timer with 409', async () => {
    await api.post('/api/timer/start').send({ bookId: await bookId('Project Hail Mary') });
    const second = await api.post('/api/timer/start').send({ bookId: await bookId('Piranesi') });
    expect(second.status).toBe(409);
    expect(errorOf(second.body).code).toBe('timer_running');
  });
});

describe('POST /api/timer/start', () => {
  it('uses the given start page and starts a new book on page 1 by default', async () => {
    const id = await bookId('Piranesi');
    const timer = timerOf((await api.post('/api/timer/start').send({ bookId: id })).body);
    expect(timer?.session.startPage).toBe(1);
    expect(timer?.previous).toBeNull();
    // Discarding a timer deletes its session.
    await api.delete(`/api/reading-sessions/${timer!.session.id}`).expect(204);
    expect(await getTimer()).toBeNull();

    const chosen = await api.post('/api/timer/start').send({ bookId: id, startPage: 12 });
    expect(timerOf(chosen.body)?.session.startPage).toBe(12);
  });

  it('rejects bad bodies, unknown books and a start page past the last page', async () => {
    const bad = await api.post('/api/timer/start').send({ bookId: 'nope', startPage: 0 });
    expect(bad.status).toBe(400);
    expect(Object.keys(errorOf(bad.body).fields ?? {}).sort()).toEqual(['bookId', 'startPage']);

    const missing = await api.post('/api/timer/start').send({ bookId: missingId });
    expect(missing.status).toBe(404);

    const atEnd = await api
      .post('/api/timer/start')
      .send({ bookId: await bookId('Piranesi'), startPage: 273 });
    expect(atEnd.status).toBe(400);
    expect(errorOf(atEnd.body).fields?.startPage).toBeDefined();
    expect(await getTimer()).toBeNull();
  });
});

describe('PATCH /api/timer', () => {
  it('changes the running timer’s start page', async () => {
    await api.post('/api/timer/start').send({ bookId: await bookId('Project Hail Mary') });
    const res = await api.patch('/api/timer').send({ startPage: 170 });
    expect(res.status).toBe(200);
    expect(timerOf(res.body)?.session.startPage).toBe(170);
    expect((await getTimer())?.session.startPage).toBe(170);
  });

  it('validates the start page', async () => {
    await api.post('/api/timer/start').send({ bookId: await bookId('Project Hail Mary') });
    expect((await api.patch('/api/timer').send({ startPage: 'x' })).status).toBe(400);
    expect((await api.patch('/api/timer').send({ startPage: 477 })).status).toBe(400);
  });

  it('answers 404 without a running timer', async () => {
    const res = await api.patch('/api/timer').send({ startPage: 1 });
    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('no_timer');
  });
});

describe('pause and resume', () => {
  it('excludes paused time from the session minutes', async () => {
    await api.post('/api/timer/start').send({ bookId: await bookId('Project Hail Mary') });

    at(10);
    const paused = timerOf((await api.post('/api/timer/pause')).body);
    expect(paused?.session.pausedAt).toBe(new Date(start + 10 * 60_000).toISOString());

    at(15);
    const resumed = timerOf((await api.post('/api/timer/resume')).body);
    expect(resumed?.session).toMatchObject({ pausedAt: null, pausedSeconds: 300 });

    at(35);
    const saved = saveSessionResponseSchema.parse(
      (await api.post('/api/timer/stop').send({ endPage: 194 })).body,
    );
    expect(saved.session.metrics).toEqual({ pages: 20, minutes: 30, speed: 40 });
  });

  it('stops a paused timer at the moment it was paused', async () => {
    await api.post('/api/timer/start').send({ bookId: await bookId('Project Hail Mary') });
    at(41);
    await api.post('/api/timer/pause').expect(200);
    at(45); // time spent on the Finish screen
    const saved = saveSessionResponseSchema.parse(
      (await api.post('/api/timer/stop').send({ endPage: 206 })).body,
    );
    expect(saved.session.endedAt).toBe(new Date(start + 41 * 60_000).toISOString());
    expect(saved.session).toMatchObject({ pausedAt: null, pausedSeconds: 0 });
    expect(saved.session.metrics?.minutes).toBe(41);
  });

  it('answers 409 for a pause while paused or a resume while running', async () => {
    await api.post('/api/timer/start').send({ bookId: await bookId('Project Hail Mary') });
    const resume = await api.post('/api/timer/resume');
    expect(resume.status).toBe(409);
    expect(errorOf(resume.body).code).toBe('timer_not_paused');

    await api.post('/api/timer/pause').expect(200);
    const again = await api.post('/api/timer/pause');
    expect(again.status).toBe(409);
    expect(errorOf(again.body).code).toBe('timer_paused');
  });

  it('answers 404 without a running timer', async () => {
    expect((await api.post('/api/timer/pause')).status).toBe(404);
    expect((await api.post('/api/timer/resume')).status).toBe(404);
  });
});

describe('POST /api/timer/stop', () => {
  beforeEach(async () => {
    await api.post('/api/timer/start').send({ bookId: await bookId('Project Hail Mary') });
    at(30);
  });

  it('runs the hard rules (400) and keeps the timer running', async () => {
    const res = await api.post('/api/timer/stop').send({ endPage: 500 });
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.endPage).toEqual([
      'End page can’t be above the book’s 476 pages.',
    ]);
    expect(await getTimer()).not.toBeNull();

    const noProgress = await api.post('/api/timer/stop').send({ endPage: 174 });
    expect(noProgress.status).toBe(400);
  });

  it('validates the body', async () => {
    const res = await api.post('/api/timer/stop').send({ endPage: 1.5 });
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.endPage).toBeDefined();
  });

  it('answers 409 with page warnings until they are confirmed', async () => {
    await api.patch('/api/timer').send({ startPage: 181 });
    const conflict = await api.post('/api/timer/stop').send({ endPage: 200 });
    expect(conflict.status).toBe(409);
    expect(sessionWarningsResponseSchema.parse(conflict.body).warnings).toEqual([
      expect.objectContaining({ code: 'page_gap_before', suggestion: { startPage: 175 } }),
    ]);
    expect(await getTimer()).not.toBeNull();

    const saved = await api.post('/api/timer/stop').send({ endPage: 200, confirmWarnings: true });
    expect(saved.status).toBe(200);
    expect(await getTimer()).toBeNull();
  });

  it('answers 404 once the timer has stopped', async () => {
    await api.post('/api/timer/stop').send({ endPage: 190 }).expect(200);
    const res = await api.post('/api/timer/stop').send({ endPage: 200 });
    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('no_timer');
  });
});

describe('rule 6 through the timer', () => {
  it('moves a want_to_read book to reading and offers to finish on the last page', async () => {
    const id = await bookId('Piranesi');
    await api.post('/api/timer/start').send({ bookId: id, startPage: 250 });
    at(30);
    const saved = saveSessionResponseSchema.parse(
      (await api.post('/api/timer/stop').send({ endPage: 272 })).body,
    );
    expect(saved.book.status).toBe('reading');
    expect(saved.offerFinish).toBe(true);
  });

  it('ignores the running timer in book stats and progress', async () => {
    const id = await bookId('Project Hail Mary');
    const before = bookDetailSchema.parse((await api.get(`/api/books/${id}`)).body);
    await api.post('/api/timer/start').send({ bookId: id });
    at(20);
    const during = bookDetailSchema.parse((await api.get(`/api/books/${id}`)).body);
    expect(during).toEqual(before);
  });
});
