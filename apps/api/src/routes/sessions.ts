import { Router } from 'express';
import {
  checkSessionBodySchema,
  createSessionSchema,
  sessionIdParamsSchema,
  updateSessionSchema,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { userIdOf } from '../middleware/auth';
import { parseBody, parseParams } from '../middleware/validate';
import { checkDraft, createSession, deleteSession, updateSession } from '../services/sessions';

export function sessionsRouter(db: Db) {
  const router = Router();

  router.post('/check', (req, res) => {
    res.json(checkDraft(db, userIdOf(req), parseBody(checkSessionBodySchema, req.body)));
  });

  router.post('/', (req, res) => {
    res
      .status(201)
      .json(createSession(db, userIdOf(req), parseBody(createSessionSchema, req.body)));
  });

  router.patch('/:id', (req, res) => {
    const { id } = parseParams(sessionIdParamsSchema, req.params);
    res.json(updateSession(db, userIdOf(req), id, parseBody(updateSessionSchema, req.body)));
  });

  router.delete('/:id', (req, res) => {
    const { id } = parseParams(sessionIdParamsSchema, req.params);
    deleteSession(db, userIdOf(req), id);
    res.status(204).end();
  });

  return router;
}
