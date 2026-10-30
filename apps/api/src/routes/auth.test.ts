import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiErrorSchema,
  authResponseSchema,
  listBooksResponseSchema,
  meResponseSchema,
  statsStreaksResponseSchema,
  timerResponseSchema,
} from '@reading-tracker/shared';
import { createApp } from '../app';
import type { Db } from '../db/client';
import { demoUser, seed } from '../db/seed';
import { tokenLifetimeMs } from '../services/auth';
import { authedAgent } from '../test/auth';
import { createTestDb } from '../test/db';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = createTestDb();
  seed(db, new Date(), 'America/Fortaleza');
  app = createApp({ db, timeZone: 'America/Fortaleza' });
});

afterEach(() => {
  vi.useRealTimers();
});

const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;
const bearer = (token: string) => `Bearer ${token}`;

const signUp = (body: object) => request(app).post('/api/auth/sign-up').send(body);
const signIn = (nick: string, password: string) =>
  request(app).post('/api/auth/sign-in').send({ nick, password });
const newAccount = { name: 'Ana Lima', nick: 'ana', password: 'correct horse' };

describe('POST /api/auth/sign-up', () => {
  it('creates the account and returns a working token', async () => {
    const res = await signUp({ ...newAccount, nick: '  Ana ' });
    expect(res.status).toBe(201);
    const { token, user } = authResponseSchema.parse(res.body);
    expect(user).toMatchObject({ name: 'Ana Lima', nick: 'ana' });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const me = await request(app).get('/api/me').set('Authorization', bearer(token));
    expect(me.status).toBe(200);
    expect(meResponseSchema.parse(me.body).user.id).toBe(user.id);
  });

  it('starts the new account with an empty library', async () => {
    const { token } = authResponseSchema.parse((await signUp(newAccount)).body);
    const res = await request(app).get('/api/books').set('Authorization', bearer(token));
    expect(listBooksResponseSchema.parse(res.body).books).toEqual([]);
  });

  it('refuses a taken nick, ignoring case', async () => {
    const res = await signUp({ ...newAccount, nick: 'DEMO' });
    expect(res.status).toBe(409);
    const error = errorOf(res.body);
    expect(error.code).toBe('nick_taken');
    expect(error.fields?.nick).toEqual(['That nick is taken']);
  });

  it('rejects invalid fields', async () => {
    const res = await signUp({ name: '', nick: 'a b', password: 'short' });
    expect(res.status).toBe(400);
    expect(Object.keys(errorOf(res.body).fields ?? {}).sort()).toEqual([
      'name',
      'nick',
      'password',
    ]);
    expect((await signUp({})).status).toBe(400);
  });
});

describe('POST /api/auth/sign-in', () => {
  it('signs in with nick and password, the nick in any case', async () => {
    const res = await signIn('Demo', demoUser.password);
    expect(res.status).toBe(200);
    const { token, user } = authResponseSchema.parse(res.body);
    expect(user.nick).toBe('demo');
    const books = await request(app).get('/api/books').set('Authorization', bearer(token));
    expect(listBooksResponseSchema.parse(books.body).books).toHaveLength(5);
  });

  it('answers 401 for a wrong password or an unknown nick, with the same message', async () => {
    const wrong = await signIn('demo', 'not the password');
    const unknown = await signIn('nobody', demoUser.password);
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(errorOf(wrong.body)).toEqual(errorOf(unknown.body));
    expect(errorOf(wrong.body).code).toBe('invalid_credentials');
  });

  it('rejects empty fields', async () => {
    const res = await signIn('', '');
    expect(res.status).toBe(400);
    expect(Object.keys(errorOf(res.body).fields ?? {}).sort()).toEqual(['nick', 'password']);
  });
});

describe('POST /api/auth/sign-out', () => {
  it('ends only the token that signed out', async () => {
    const first = authResponseSchema.parse((await signIn('demo', demoUser.password)).body).token;
    const second = authResponseSchema.parse((await signIn('demo', demoUser.password)).body).token;

    const out = await request(app).post('/api/auth/sign-out').set('Authorization', bearer(first));
    expect(out.status).toBe(204);
    expect((await request(app).get('/api/me').set('Authorization', bearer(first))).status).toBe(
      401,
    );
    expect((await request(app).get('/api/me').set('Authorization', bearer(second))).status).toBe(
      200,
    );
  });

  it('needs a token', async () => {
    expect((await request(app).post('/api/auth/sign-out')).status).toBe(401);
  });
});

describe('protected routes', () => {
  it.each([
    ['GET', '/api/me'],
    ['GET', '/api/books'],
    ['POST', '/api/books'],
    ['GET', '/api/books/00000000-0000-4000-8000-000000000000'],
    ['POST', '/api/reading-sessions'],
    ['POST', '/api/reading-sessions/check'],
    ['GET', '/api/timer'],
    ['POST', '/api/timer/start'],
    ['GET', '/api/stats/summary?period=week'],
    ['GET', '/api/stats/streaks'],
  ])('%s %s answers 401 without a token', async (method, path) => {
    const res = await request(app)[method === 'GET' ? 'get' : 'post'](path);
    expect(res.status).toBe(401);
    expect(res.headers['www-authenticate']).toBe('Bearer');
    expect(errorOf(res.body).code).toBe('unauthorized');
  });

  it.each([['Bearer nope'], ['Basic ZGVtbzpwYWdlY2xvY2s='], ['Bearer'], ['token-without-scheme']])(
    'answers 401 for Authorization: %s',
    async (header) => {
      const res = await request(app).get('/api/books').set('Authorization', header);
      expect(res.status).toBe(401);
    },
  );

  it('answers 401 once the token has expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
    const { token } = authResponseSchema.parse((await signIn('demo', demoUser.password)).body);
    vi.setSystemTime(Date.now() + tokenLifetimeMs + 1000);
    expect((await request(app).get('/api/me').set('Authorization', bearer(token))).status).toBe(
      401,
    );
  });

  it('keeps health public', async () => {
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('/api/me', () => {
  let api: ReturnType<typeof authedAgent>;

  beforeEach(async () => {
    const { user } = authResponseSchema.parse((await signUp(newAccount)).body);
    api = authedAgent(app, db, user.id);
  });

  it('returns the signed-in user', async () => {
    const res = await api.get('/api/me');
    expect(meResponseSchema.parse(res.body).user).toMatchObject({ name: 'Ana Lima', nick: 'ana' });
  });

  it('updates the name and nick', async () => {
    const res = await api.patch('/api/me').send({ name: ' Ana L. ', nick: 'Ana.Lima' });
    expect(res.status).toBe(200);
    expect(meResponseSchema.parse(res.body).user).toMatchObject({
      name: 'Ana L.',
      nick: 'ana.lima',
    });
    expect((await signIn('ana.lima', newAccount.password)).status).toBe(200);
    expect((await signIn('ana', newAccount.password)).status).toBe(401);
  });

  it('allows saving the current nick again', async () => {
    expect((await api.patch('/api/me').send({ nick: 'ANA' })).status).toBe(200);
  });

  it('refuses a nick another user has', async () => {
    const res = await api.patch('/api/me').send({ nick: 'demo' });
    expect(res.status).toBe(409);
    expect(errorOf(res.body).fields?.nick).toBeDefined();
  });

  it('rejects an empty or invalid update', async () => {
    expect((await api.patch('/api/me').send({})).status).toBe(400);
    const res = await api.patch('/api/me').send({ nick: 'x' });
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.nick).toBeDefined();
  });
});

describe('PUT /api/me/password', () => {
  it('changes the password after checking the current one, and signs out other devices', async () => {
    const { token: other } = authResponseSchema.parse(
      (await signIn('demo', demoUser.password)).body,
    );
    const { token, user } = authResponseSchema.parse(
      (await signIn('demo', demoUser.password)).body,
    );
    const res = await request(app)
      .put('/api/me/password')
      .set('Authorization', bearer(token))
      .send({ currentPassword: demoUser.password, newPassword: 'a brand new one' });
    expect(res.status).toBe(204);

    expect((await signIn('demo', demoUser.password)).status).toBe(401);
    expect((await signIn('demo', 'a brand new one')).status).toBe(200);
    // This device stays signed in; the other one is signed out.
    expect((await request(app).get('/api/me').set('Authorization', bearer(token))).status).toBe(
      200,
    );
    expect((await request(app).get('/api/me').set('Authorization', bearer(other))).status).toBe(
      401,
    );
    expect(user.nick).toBe('demo');
  });

  it('refuses a wrong current password with a field error', async () => {
    const { user } = authResponseSchema.parse((await signIn('demo', demoUser.password)).body);
    const res = await authedAgent(app, db, user.id)
      .put('/api/me/password')
      .send({ currentPassword: 'wrong', newPassword: 'a brand new one' });
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.currentPassword).toEqual(['The current password is wrong']);
    expect((await signIn('demo', demoUser.password)).status).toBe(200);
  });

  it('validates the new password', async () => {
    const { user } = authResponseSchema.parse((await signIn('demo', demoUser.password)).body);
    const res = await authedAgent(app, db, user.id)
      .put('/api/me/password')
      .send({ currentPassword: demoUser.password, newPassword: 'short' });
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.newPassword).toBeDefined();
  });
});

describe('each user sees only their own data', () => {
  let demo: ReturnType<typeof authedAgent>;
  let ana: ReturnType<typeof authedAgent>;
  let demoBookId: string;

  beforeEach(async () => {
    const demoAuth = authResponseSchema.parse((await signIn('demo', demoUser.password)).body);
    const anaAuth = authResponseSchema.parse((await signUp(newAccount)).body);
    demo = authedAgent(app, db, demoAuth.user.id);
    ana = authedAgent(app, db, anaAuth.user.id);
    const { books } = listBooksResponseSchema.parse((await demo.get('/api/books')).body);
    demoBookId = books.find((b) => b.title === 'Project Hail Mary')!.id;
  });

  it('hides other users’ books, as if they did not exist', async () => {
    expect((await ana.get(`/api/books/${demoBookId}`)).status).toBe(404);
    expect((await ana.get(`/api/books/${demoBookId}/sessions`)).status).toBe(404);
    expect((await ana.patch(`/api/books/${demoBookId}`).send({ title: 'Mine' })).status).toBe(404);
    expect((await ana.delete(`/api/books/${demoBookId}`)).status).toBe(404);
    expect((await demo.get(`/api/books/${demoBookId}`)).status).toBe(200);
  });

  it('refuses sessions and timers on other users’ books', async () => {
    const now = Date.now();
    const session = {
      bookId: demoBookId,
      startedAt: new Date(now - 60 * 60_000).toISOString(),
      endedAt: new Date(now - 30 * 60_000).toISOString(),
      startPage: 175,
      endPage: 180,
    };
    expect((await ana.post('/api/reading-sessions').send(session)).status).toBe(404);
    expect((await ana.post('/api/reading-sessions/check').send(session)).status).toBe(404);
    expect((await ana.post('/api/timer/start').send({ bookId: demoBookId })).status).toBe(404);

    const { sessions } = (await demo.get(`/api/books/${demoBookId}/sessions`)).body as {
      sessions: { id: string }[];
    };
    const id = sessions[0]!.id;
    expect((await ana.patch(`/api/reading-sessions/${id}`).send({ endPage: 174 })).status).toBe(
      404,
    );
    expect((await ana.delete(`/api/reading-sessions/${id}`)).status).toBe(404);
  });

  it('gives each user their own timer', async () => {
    const created = await ana
      .post('/api/books')
      .send({ title: 'Dune', author: 'F', totalPages: 9 });
    expect((await demo.post('/api/timer/start').send({ bookId: demoBookId })).status).toBe(201);
    expect(timerResponseSchema.parse((await ana.get('/api/timer')).body).timer).toBeNull();
    expect((await ana.post('/api/timer/start').send({ bookId: created.body.id })).status).toBe(201);
  });

  it('keeps stats per user', async () => {
    const theirs = statsStreaksResponseSchema.parse((await ana.get('/api/stats/streaks')).body);
    const mine = statsStreaksResponseSchema.parse((await demo.get('/api/stats/streaks')).body);
    expect(theirs.longest).toBe(0);
    expect(mine.longest).toBeGreaterThan(0);
  });
});
