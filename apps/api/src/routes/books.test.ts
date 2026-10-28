import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { apiErrorSchema, listBooksResponseSchema } from '@reading-tracker/shared';
import { createApp } from '../app';
import { seed } from '../db/seed';
import { createTestDb } from '../test/db';

const db = createTestDb();
const app = createApp({ db });

beforeAll(() => {
  seed(db, new Date('2026-10-28T15:00:00Z'), 'America/Fortaleza');
});

const titles = (body: unknown) => listBooksResponseSchema.parse(body).books.map((b) => b.title);

describe('GET /api/books', () => {
  it('lists all books, most recently updated first', async () => {
    const res = await request(app).get('/api/books');
    expect(res.status).toBe(200);
    const list = titles(res.body);
    expect(list).toHaveLength(5);
    expect(list[0]).toBe('Project Hail Mary');
  });

  it('treats empty filters as no filter', async () => {
    const res = await request(app).get('/api/books?status=&q=');
    expect(res.status).toBe(200);
    expect(titles(res.body)).toHaveLength(5);
  });

  it('filters by status', async () => {
    const res = await request(app).get('/api/books?status=want_to_read');
    expect(res.status).toBe(200);
    expect(titles(res.body).sort()).toEqual(['Piranesi', 'The Dispossessed']);
  });

  it('searches title and author, case-insensitively', async () => {
    expect(titles((await request(app).get('/api/books?q=le%20guin')).body)).toHaveLength(2);
    expect(titles((await request(app).get('/api/books?q=HAIL')).body)).toEqual([
      'Project Hail Mary',
    ]);
  });

  it('treats LIKE wildcards in q literally', async () => {
    const res = await request(app).get('/api/books?q=%25');
    expect(titles(res.body)).toEqual([]);
  });

  it('combines status and q', async () => {
    const res = await request(app).get('/api/books?status=finished&q=guin');
    expect(titles(res.body)).toEqual(['The Left Hand of Darkness']);
  });

  it('rejects an unknown status with field errors', async () => {
    const res = await request(app).get('/api/books?status=abandoned');
    expect(res.status).toBe(400);
    const { error } = apiErrorSchema.parse(res.body);
    expect(error.code).toBe('validation_error');
    expect(error.fields?.status).toBeDefined();
  });

  it('rejects a repeated status parameter', async () => {
    const res = await request(app).get('/api/books?status=reading&status=finished');
    expect(res.status).toBe(400);
  });
});
