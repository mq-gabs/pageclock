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
import { authedAgent, createTestUser } from '../test/auth';
import { createTestDb } from '../test/db';

let db: Db;
let api: ReturnType<typeof authedAgent>;
let userId: string;
const start = Date.now();
const missingId = '00000000-0000-4000-8000-000000000000';

/** Moves the (faked) clock to `minutes` after the test started. */
const at = (minutes: number) => vi.setSystemTime(start + minutes * 60_000);
const iso = (minutes: number) => new Date(start + minutes * 60_000).toISOString();

/** The session the browser named in the last Start body (`missingId` before any). */
let sessionId = missingId;
const uuid = () => crypto.randomUUID();
/** A Start body clicked "now" (the faked clock). */
function startBody(bookId: string, extra: { startPage?: number; startedAt?: string } = {}) {
  sessionId = uuid();
  return { opId: uuid(), sessionId, bookId, startedAt: new Date().toISOString(), ...extra };
}
/** A Pause/Resume body for the last started session, clicked now unless `at` says otherwise. */
const action = (extra: { at?: string; opId?: string; sessionId?: string } = {}) => ({
  opId: uuid(),
  sessionId,
  at: new Date().toISOString(),
  ...extra,
});
const startPageBody = (startPage: unknown) => ({ opId: uuid(), sessionId, startPage });

beforeEach(() => {
  sessionId = missingId;
  vi.useFakeTimers({ toFake: ['Date'], now: start });
  db = createTestDb();
  userId = seed(db, new Date(start), 'America/Fortaleza').userId;
  api = authedAgent(createApp({ db, timeZone: 'America/Fortaleza' }), db, userId);
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

    const started = await api.post('/api/timer/start').send(startBody(id));
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
    api = authedAgent(createApp({ db, timeZone: 'America/Fortaleza' }), db, userId);
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
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    const second = await api.post('/api/timer/start').send(startBody(await bookId('Piranesi')));
    expect(second.status).toBe(409);
    expect(errorOf(second.body).code).toBe('timer_running');
  });
});

describe('POST /api/timer/start', () => {
  it('uses the given start page and starts a new book on page 1 by default', async () => {
    const id = await bookId('Piranesi');
    const timer = timerOf((await api.post('/api/timer/start').send(startBody(id))).body);
    expect(timer?.session.startPage).toBe(1);
    expect(timer?.previous).toBeNull();
    // Discarding a timer deletes its session.
    await api.delete(`/api/reading-sessions/${timer!.session.id}`).expect(204);
    expect(await getTimer()).toBeNull();

    const chosen = await api.post('/api/timer/start').send(startBody(id, { startPage: 12 }));
    expect(timerOf(chosen.body)?.session.startPage).toBe(12);
  });

  it('rejects bad bodies, unknown books and a start page past the last page', async () => {
    const bad = await api.post('/api/timer/start').send(startBody('nope', { startPage: 0 }));
    expect(bad.status).toBe(400);
    expect(Object.keys(errorOf(bad.body).fields ?? {}).sort()).toEqual(['bookId', 'startPage']);

    const missing = await api.post('/api/timer/start').send(startBody(missingId));
    expect(missing.status).toBe(404);

    const atEnd = await api
      .post('/api/timer/start')
      .send(startBody(await bookId('Piranesi'), { startPage: 273 }));
    expect(atEnd.status).toBe(400);
    expect(errorOf(atEnd.body).fields?.startPage).toBeDefined();
    expect(await getTimer()).toBeNull();
  });
});

describe('PATCH /api/timer', () => {
  it('changes the running timer’s start page', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    const res = await api.patch('/api/timer').send(startPageBody(170));
    expect(res.status).toBe(200);
    expect(timerOf(res.body)?.session.startPage).toBe(170);
    expect((await getTimer())?.session.startPage).toBe(170);
  });

  it('validates the start page', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    expect((await api.patch('/api/timer').send(startPageBody('x'))).status).toBe(400);
    expect((await api.patch('/api/timer').send(startPageBody(477))).status).toBe(400);
  });

  it('answers 404 without a running timer', async () => {
    const res = await api.patch('/api/timer').send(startPageBody(1));
    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('no_timer');
  });
});

describe('pause and resume', () => {
  it('excludes paused time from the session minutes', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));

    at(10);
    const paused = timerOf((await api.post('/api/timer/pause').send(action())).body);
    expect(paused?.session.pausedAt).toBe(new Date(start + 10 * 60_000).toISOString());

    at(15);
    const resumed = timerOf((await api.post('/api/timer/resume').send(action())).body);
    expect(resumed?.session).toMatchObject({ pausedAt: null, pausedSeconds: 300 });

    at(35);
    const saved = saveSessionResponseSchema.parse(
      (await api.post('/api/timer/stop').send({ endPage: 194 })).body,
    );
    expect(saved.session.metrics).toEqual({ pages: 20, minutes: 30, speed: 40 });
  });

  it('stops a paused timer at the moment it was paused', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    at(41);
    await api.post('/api/timer/pause').send(action()).expect(200);
    at(45); // time spent on the Finish screen
    const saved = saveSessionResponseSchema.parse(
      (await api.post('/api/timer/stop').send({ endPage: 206 })).body,
    );
    expect(saved.session.endedAt).toBe(new Date(start + 41 * 60_000).toISOString());
    expect(saved.session).toMatchObject({ pausedAt: null, pausedSeconds: 0 });
    expect(saved.session.metrics?.minutes).toBe(41);
  });

  it('answers 409 for a pause while paused or a resume while running', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    const resume = await api.post('/api/timer/resume').send(action());
    expect(resume.status).toBe(409);
    expect(errorOf(resume.body).code).toBe('timer_not_paused');

    await api.post('/api/timer/pause').send(action()).expect(200);
    const again = await api.post('/api/timer/pause').send(action());
    expect(again.status).toBe(409);
    expect(errorOf(again.body).code).toBe('timer_paused');
  });

  it('answers 404 without a running timer', async () => {
    expect((await api.post('/api/timer/pause').send(action())).status).toBe(404);
    expect((await api.post('/api/timer/resume').send(action())).status).toBe(404);
  });
});

describe('POST /api/timer/stop', () => {
  beforeEach(async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
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
    await api.patch('/api/timer').send(startPageBody(181));
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
    await api.post('/api/timer/start').send(startBody(id, { startPage: 250 }));
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
    await api.post('/api/timer/start').send(startBody(id));
    at(20);
    const during = bookDetailSchema.parse((await api.get(`/api/books/${id}`)).body);
    expect(during).toEqual(before);
  });
});

describe('click times (rule 5a)', () => {
  it('stores the click times, not the arrival times', async () => {
    const id = await bookId('Project Hail Mary');
    at(2); // the Start clicked at minute 0 arrives at minute 2
    const started = await api.post('/api/timer/start').send(startBody(id, { startedAt: iso(0) }));
    expect(timerOf(started.body)?.session.startedAt).toBe(iso(0));

    at(12);
    const paused = await api.post('/api/timer/pause').send(action({ at: iso(10) }));
    expect(timerOf(paused.body)?.session.pausedAt).toBe(iso(10));

    at(20);
    const resumed = await api.post('/api/timer/resume').send(action({ at: iso(15) }));
    expect(timerOf(resumed.body)?.session).toMatchObject({ pausedAt: null, pausedSeconds: 300 });

    at(36);
    await api
      .post('/api/timer/pause')
      .send(action({ at: iso(35) }))
      .expect(200);
    const saved = saveSessionResponseSchema.parse(
      (await api.post('/api/timer/stop').send({ endPage: 194 })).body,
    );
    expect(saved.session).toMatchObject({ startedAt: iso(0), endedAt: iso(35) });
    expect(saved.session.metrics?.minutes).toBe(30);
  });

  it('applies rule 1 at the click time of the Start', async () => {
    const id = await bookId('Piranesi');
    // A session from minute −40 to −30 that the Start, clicked at minute −60, came before.
    await api
      .post('/api/reading-sessions')
      .send({ bookId: id, startedAt: iso(-40), endedAt: iso(-30), startPage: 1, endPage: 20 })
      .expect(201);
    const before = await api.post('/api/timer/start').send(startBody(id, { startedAt: iso(-60) }));
    expect(timerOf(before.body)?.session.startPage).toBe(1);
    await api.delete(`/api/reading-sessions/${sessionId}`).expect(204);

    const after = await api.post('/api/timer/start').send(startBody(id, { startedAt: iso(-20) }));
    expect(timerOf(after.body)?.session.startPage).toBe(21);
  });

  it('rejects a pause or resume before the start, and a resume before its pause', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    at(10);
    const early = await api.post('/api/timer/pause').send(action({ at: iso(-1) }));
    expect(early.status).toBe(400);
    expect(errorOf(early.body)).toMatchObject({ code: 'action_before_start' });
    expect(errorOf(early.body).fields?.at).toBeDefined();

    await api
      .post('/api/timer/pause')
      .send(action({ at: iso(8) }))
      .expect(200);
    const backwards = await api.post('/api/timer/resume').send(action({ at: iso(7) }));
    expect(backwards.status).toBe(400);
    expect(errorOf(backwards.body).code).toBe('resume_before_pause');
    expect((await getTimer())?.session.pausedAt).toBe(iso(8));
  });

  it('clamps a click time ahead of the server clock to now', async () => {
    const id = await bookId('Project Hail Mary');
    const started = await api.post('/api/timer/start').send(startBody(id, { startedAt: iso(30) }));
    expect(timerOf(started.body)?.session.startedAt).toBe(iso(0));

    at(10);
    const paused = await api.post('/api/timer/pause').send(action({ at: iso(60) }));
    expect(timerOf(paused.body)?.session.pausedAt).toBe(iso(10));
  });

  it('applies the 12 h limit of rule 2', async () => {
    const id = await bookId('Project Hail Mary');
    const stale = await api
      .post('/api/timer/start')
      .send(startBody(id, { startedAt: iso(-12 * 60 - 1) }));
    expect(stale.status).toBe(400);
    expect(errorOf(stale.body).code).toBe('too_long');
    expect(await getTimer()).toBeNull();

    await api.post('/api/timer/start').send(startBody(id)).expect(201);
    at(12 * 60 + 5);
    const late = await api.post('/api/timer/pause').send(action({ at: iso(12 * 60 + 1) }));
    expect(late.status).toBe(400);
    expect(errorOf(late.body).code).toBe('too_long');
  });

  it('validates the action body', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    const res = await api.post('/api/timer/pause').send({ opId: 'x', at: 'yesterday' });
    expect(res.status).toBe(400);
    expect(Object.keys(errorOf(res.body).fields ?? {}).sort()).toEqual(['at', 'opId', 'sessionId']);
  });
});

describe('retries are safe', () => {
  it('answers a repeated opId with 200 and changes nothing', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    at(10);
    const pause = action();
    await api.post('/api/timer/pause').send(pause).expect(200);

    at(12); // the answer was lost; the queue retries the same action
    const retry = await api.post('/api/timer/pause').send({ ...pause, at: iso(12) });
    expect(retry.status).toBe(200);
    expect(timerOf(retry.body)?.session.pausedAt).toBe(iso(10));

    const update = startPageBody(170);
    await api.patch('/api/timer').send(update).expect(200);
    await api
      .patch('/api/timer')
      .send({ ...update, startPage: 171 })
      .expect(200);
    expect((await getTimer())?.session.startPage).toBe(170);
  });

  it('answers a repeated Start with the running timer, and another Start with 409', async () => {
    const id = await bookId('Project Hail Mary');
    const body = startBody(id);
    const first = await api.post('/api/timer/start').send(body);
    expect(first.status).toBe(201);

    at(1);
    const again = await api.post('/api/timer/start').send({ ...body, opId: uuid() });
    expect(again.status).toBe(200);
    expect(timerOf(again.body)?.session).toMatchObject({ id: body.sessionId, startedAt: iso(0) });

    const other = await api.post('/api/timer/start').send(startBody(id));
    expect(other.status).toBe(409);
    expect(errorOf(other.body).code).toBe('timer_running');
  });

  it('refuses to start a session id that has already ended', async () => {
    const id = await bookId('Project Hail Mary');
    const body = startBody(id);
    await api.post('/api/timer/start').send(body).expect(201);
    at(30);
    await api.post('/api/timer/stop').send({ endPage: 190 }).expect(200);
    const res = await api.post('/api/timer/start').send({ ...body, opId: uuid() });
    expect(res.status).toBe(409);
    expect(errorOf(res.body).code).toBe('session_exists');
  });

  it('answers 404 for a session that isn’t the running one', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    const res = await api.post('/api/timer/pause').send(action({ sessionId: missingId }));
    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('no_timer');
    expect(
      (await api.patch('/api/timer').send({ ...startPageBody(3), sessionId: missingId })).status,
    ).toBe(404);
  });

  it('answers 404 for another user’s session', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    const other = authedAgent(
      createApp({ db, timeZone: 'America/Fortaleza' }),
      db,
      createTestUser(db).id,
    );
    const res = await other.post('/api/timer/pause').send(action());
    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('no_timer');
    expect((await getTimer())?.session.pausedAt).toBeNull();
  });

  it('answers 404 for a pause of a stopped session', async () => {
    await api.post('/api/timer/start').send(startBody(await bookId('Project Hail Mary')));
    at(30);
    await api.post('/api/timer/stop').send({ endPage: 190 }).expect(200);
    const res = await api.post('/api/timer/pause').send(action());
    expect(res.status).toBe(404);
    expect(errorOf(res.body).code).toBe('no_timer');
  });
});
