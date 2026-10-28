import { Router } from 'express';
import {
  checkSessionBodySchema,
  createSessionSchema,
  sessionIdParamsSchema,
  updateSessionSchema,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { parseBody, parseParams } from '../middleware/validate';
import { checkDraft, createSession, deleteSession, updateSession } from '../services/sessions';

export function sessionsRouter(db: Db) {
  const router = Router();

  router.post('/check', (req, res) => {
    res.json(checkDraft(db, parseBody(checkSessionBodySchema, req.body)));
  });

  router.post('/', (req, res) => {
    res.status(201).json(createSession(db, parseBody(createSessionSchema, req.body)));
  });

  router.patch('/:id', (req, res) => {
    const { id } = parseParams(sessionIdParamsSchema, req.params);
    res.json(updateSession(db, id, parseBody(updateSessionSchema, req.body)));
  });

  router.delete('/:id', (req, res) => {
    const { id } = parseParams(sessionIdParamsSchema, req.params);
    deleteSession(db, id);
    res.status(204).end();
  });

  return router;
}
