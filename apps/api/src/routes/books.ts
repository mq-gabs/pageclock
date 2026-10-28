import { Router } from 'express';
import {
  bookIdParamsSchema,
  createBookSchema,
  listBooksQuerySchema,
  updateBookSchema,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { parseBody, parseParams, parseQuery } from '../middleware/validate';
import { createBook, deleteBook, getBook, listBooks, updateBook } from '../services/books';

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

  return router;
}
