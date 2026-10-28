import { Router } from 'express';
import { listBooksQuerySchema, type ListBooksResponse } from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { parseQuery } from '../middleware/validate';
import { listBooks } from '../services/books';

export function booksRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    const query = parseQuery(listBooksQuerySchema, req.query);
    const body: ListBooksResponse = { books: listBooks(db, query) };
    res.json(body);
  });

  return router;
}
