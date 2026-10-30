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
import { userIdOf } from '../middleware/auth';
import { parseBody, parseParams, parseQuery } from '../middleware/validate';
import { createBook, deleteBook, getBook, listBooks, updateBook } from '../services/books';
import { listBookSessions, suggestedStartPage } from '../services/sessions';

export function booksRouter(db: Db, timeZone: string) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(listBooks(db, userIdOf(req), parseQuery(listBooksQuerySchema, req.query)));
  });

  router.post('/', (req, res) => {
    res.status(201).json(createBook(db, userIdOf(req), parseBody(createBookSchema, req.body)));
  });

  router.get('/:id', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    res.json(getBook(db, userIdOf(req), id, timeZone));
  });

  router.patch('/:id', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    res.json(updateBook(db, userIdOf(req), id, parseBody(updateBookSchema, req.body)));
  });

  router.delete('/:id', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    deleteBook(db, userIdOf(req), id);
    res.status(204).end();
  });

  router.get('/:id/sessions', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    const body: ListSessionsResponse = { sessions: listBookSessions(db, userIdOf(req), id) };
    res.json(body);
  });

  router.get('/:id/suggested-start-page', (req, res) => {
    const { id } = parseParams(bookIdParamsSchema, req.params);
    const { at } = parseQuery(suggestedStartPageQuerySchema, req.query);
    res.json({
      startPage: suggestedStartPage(db, userIdOf(req), id, at ? new Date(at) : new Date()),
    });
  });

  return router;
}
