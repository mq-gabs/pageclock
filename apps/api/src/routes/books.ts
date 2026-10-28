import { Router } from 'express';
import {
  bookIdParamsSchema,
  createBookSchema,
  listBooksQuerySchema,
  suggestedStartPageQuerySchema,
  updateBookSchema,
  type ListSessionsResponse,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { parseBody, parseParams, parseQuery } from '../middleware/validate';
import { createBook, deleteBook, getBook, listBooks, updateBook } from '../services/books';
import { listBookSessions, suggestedStartPage } from '../services/sessions';

export function booksRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(listBooks(db, parseQuery(listBooksQuerySchema, req.query)));
  });

  router.post('/', (req, res) => {
    res.status(201).json(createBook(db, parseBody(createBookSchema, req.body)));
  });

  router.get('/:id', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    res.json(getBook(db, id));
  });

  router.patch('/:id', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    res.json(updateBook(db, id, parseBody(updateBookSchema, req.body)));
  });

  router.delete('/:id', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    deleteBook(db, id);
    res.status(204).end();
  });

  router.get('/:id/sessions', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    const body: ListSessionsResponse = { sessions: listBookSessions(db, id) };
    res.json(body);
  });

  router.get('/:id/suggested-start-page', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    const { at } = parseQuery(suggestedStartPageQuerySchema, req.query);
    res.json({ startPage: suggestedStartPage(db, id, at ? new Date(at) : new Date()) });
  });

  return router;
}
