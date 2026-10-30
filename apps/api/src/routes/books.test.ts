import { beforeEach, describe, expect, it } from 'vitest';
import {
  apiErrorSchema,
  bookDetailSchema,
  bookWithProgressSchema,
  listBooksResponseSchema,
} from '@reading-tracker/shared';
import { createApp } from '../app';
import { seed } from '../db/seed';
import { authedAgent } from '../test/auth';
import { createTestDb } from '../test/db';

const now = new Date('2026-10-28T15:00:00Z');
let api: ReturnType<typeof authedAgent>;

beforeEach(() => {
  const db = createTestDb();
  const { userId } = seed(db, now, 'America/Fortaleza');
  api = authedAgent(createApp({ db, timeZone: 'America/Fortaleza' }), db, userId);
});

const list = async (query = '') =>
  listBooksResponseSchema.parse((await api.get(`/api/books${query}`)).body);
const titles = async (query = '') => (await list(query)).books.map((b) => b.title);
const idOf = async (title: string) => (await list()).books.find((b) => b.title === title)!.id;
const errorOf = (body: unknown) => apiErrorSchema.parse(body).error;
const missingId = '00000000-0000-4000-8000-000000000000';

describe('GET /api/books', () => {
  it('lists all books, most recently updated first, with progress', async () => {
    const res = await api.get('/api/books');
    expect(res.status).toBe(200);
    const { books, counts } = listBooksResponseSchema.parse(res.body);
    expect(books).toHaveLength(5);
    expect(books[0]).toMatchObject({ title: 'Project Hail Mary', progress: 174, percent: 37 });
    expect(books.find((b) => b.title === 'Piranesi')).toMatchObject({ progress: 0, percent: 0 });
    expect(books.find((b) => b.status === 'finished')).toMatchObject({ percent: 100 });
    expect(counts).toEqual({ all: 5, want_to_read: 2, reading: 2, finished: 1 });
  });

  it('treats empty filters as no filter', async () => {
    expect(await titles('?status=&q=')).toHaveLength(5);
  });

  it('filters by status but keeps counts for every status', async () => {
    const { books, counts } = await list('?status=want_to_read');
    expect(books.map((b) => b.title).sort()).toEqual(['Piranesi', 'The Dispossessed']);
    expect(counts.all).toBe(5);
  });

  it('searches title and author case-insensitively, and counts the matches', async () => {
    const { books, counts } = await list('?q=le%20guin');
    expect(books).toHaveLength(2);
    expect(counts).toEqual({ all: 2, want_to_read: 1, reading: 0, finished: 1 });
    expect(await titles('?q=HAIL')).toEqual(['Project Hail Mary']);
  });

  it('treats LIKE wildcards in q literally', async () => {
    expect(await titles('?q=%25')).toEqual([]);
  });

  it('combines status and q', async () => {
    expect(await titles('?status=finished&q=guin')).toEqual(['The Left Hand of Darkness']);
  });

  it('rejects an unknown status with field errors', async () => {
    const res = await api.get('/api/books?status=abandoned');
    expect(res.status).toBe(400);
    const error = errorOf(res.body);
    expect(error.code).toBe('validation_error');
    expect(error.fields?.status).toBeDefined();
  });

  it('rejects a repeated status parameter', async () => {
    expect((await api.get('/api/books?status=reading&status=finished')).status).toBe(400);
  });
});

describe('POST /api/books', () => {
  it('creates a book that starts as want_to_read', async () => {
    const res = await api
      .post('/api/books')
      .send({ title: ' Dune ', author: 'Frank Herbert', totalPages: 688 });
    expect(res.status).toBe(201);
    expect(bookWithProgressSchema.parse(res.body)).toMatchObject({
      title: 'Dune',
      status: 'want_to_read',
      progress: 0,
      percent: 0,
      finishedAt: null,
    });
    expect(await titles('?q=dune')).toEqual(['Dune']);
  });

  it('rejects invalid fields', async () => {
    const res = await api.post('/api/books').send({ title: '', author: 'A', totalPages: 0 });
    expect(res.status).toBe(400);
    expect(Object.keys(errorOf(res.body).fields ?? {}).sort()).toEqual(['title', 'totalPages']);
  });

  it('rejects a missing body', async () => {
    const res = await api.post('/api/books');
    expect(res.status).toBe(400);
    expect(errorOf(res.body).code).toBe('validation_error');
  });
});

describe('GET /api/books/:id', () => {
  it('returns the book with progress and per-book stats', async () => {
    const res = await api.get(`/api/books/${await idOf('Project Hail Mary')}`);
    expect(res.status).toBe(200);
    const { book, stats } = bookDetailSchema.parse(res.body);
    expect(book).toMatchObject({ progress: 174, percent: 37, status: 'reading' });
    // Seed: 7 sessions, 174 pages, 45+30+60+40+35+25+20 = 255 minutes, on 7 different days.
    expect(stats).toMatchObject({ pages: 174, minutes: 255, sessions: 7, readingDays: 7 });
    expect(stats.speed).toBeCloseTo((174 / 255) * 60);
    expect(stats.firstReadAt! < stats.lastReadAt!).toBe(true);
  });

  it('returns empty stats for a book without sessions', async () => {
    const { stats } = bookDetailSchema.parse(
      (await api.get(`/api/books/${await idOf('Piranesi')}`)).body,
    );
    expect(stats).toEqual({
      pages: 0,
      minutes: 0,
      sessions: 0,
      speed: null,
      readingDays: 0,
      firstReadAt: null,
      lastReadAt: null,
    });
  });

  it('returns 404 for an unknown id and 400 for a malformed one', async () => {
    expect((await api.get(`/api/books/${missingId}`)).status).toBe(404);
    const res = await api.get('/api/books/not-a-uuid');
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.id).toBeDefined();
  });
});

describe('PATCH /api/books/:id', () => {
  it('edits text fields', async () => {
    const id = await idOf('Piranesi');
    const res = await api
      .patch(`/api/books/${id}`)
      .send({ title: 'Piranesi (2020)', totalPages: 245 });
    expect(res.status).toBe(200);
    expect(bookWithProgressSchema.parse(res.body)).toMatchObject({
      title: 'Piranesi (2020)',
      totalPages: 245,
    });
  });

  it('sets finishedAt when finishing and clears it when reopening', async () => {
    const id = await idOf('Project Hail Mary');
    const finished = bookWithProgressSchema.parse(
      (await api.patch(`/api/books/${id}`).send({ status: 'finished' })).body,
    );
    expect(finished.status).toBe('finished');
    expect(finished.finishedAt).not.toBeNull();

    const reopened = bookWithProgressSchema.parse(
      (await api.patch(`/api/books/${id}`).send({ status: 'reading' })).body,
    );
    expect(reopened.finishedAt).toBeNull();
  });

  it('keeps the original finishedAt when a finished book is saved as finished again', async () => {
    const id = await idOf('The Left Hand of Darkness');
    const before = (await list()).books.find((b) => b.id === id)!.finishedAt;
    const res = await api
      .patch(`/api/books/${id}`)
      .send({ status: 'finished', title: 'The Left Hand of Darkness' });
    expect(bookWithProgressSchema.parse(res.body).finishedAt).toBe(before);
  });

  it('refuses total pages below the pages already read', async () => {
    const res = await api
      .patch(`/api/books/${await idOf('Project Hail Mary')}`)
      .send({ totalPages: 100 });
    expect(res.status).toBe(400);
    expect(errorOf(res.body).fields?.totalPages?.[0]).toContain('174');
  });

  it('rejects an empty or invalid update', async () => {
    const id = await idOf('Piranesi');
    expect((await api.patch(`/api/books/${id}`).send({})).status).toBe(400);
    expect((await api.patch(`/api/books/${id}`).send({ status: 'lost' })).status).toBe(400);
  });

  it('returns 404 for an unknown book', async () => {
    expect((await api.patch(`/api/books/${missingId}`).send({ title: 'x' })).status).toBe(404);
  });
});

describe('DELETE /api/books/:id', () => {
  it('deletes the book and its sessions', async () => {
    const id = await idOf('Project Hail Mary');
    expect((await api.delete(`/api/books/${id}`)).status).toBe(204);
    expect((await api.get(`/api/books/${id}`)).status).toBe(404);
    expect(await titles()).toHaveLength(4);
  });

  it('returns 404 for an unknown book and 400 for a malformed id', async () => {
    expect((await api.delete(`/api/books/${missingId}`)).status).toBe(404);
    expect((await api.delete('/api/books/nope')).status).toBe(400);
  });
});
