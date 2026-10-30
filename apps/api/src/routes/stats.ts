import { Router } from 'express';
import { statsDailyQuerySchema, statsSummaryQuerySchema } from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { userIdOf } from '../middleware/auth';
import { parseQuery } from '../middleware/validate';
import { getDaily, getStreaks, getSummary } from '../services/stats';

export function statsRouter(db: Db) {
  const router = Router();

  router.get('/summary', (req, res) => {
    res.json(getSummary(db, userIdOf(req), parseQuery(statsSummaryQuerySchema, req.query)));
  });

  router.get('/daily', (req, res) => {
    res.json(getDaily(db, userIdOf(req), parseQuery(statsDailyQuerySchema, req.query)));
  });

  router.get('/streaks', (req, res) => {
    res.json(getStreaks(db, userIdOf(req)));
  });

  return router;
}
