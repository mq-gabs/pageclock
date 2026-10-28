import { Router } from 'express';
import {
  startTimerSchema,
  stopTimerSchema,
  updateTimerSchema,
  type TimerResponse,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { parseBody } from '../middleware/validate';
import {
  getTimer,
  pauseTimer,
  resumeTimer,
  startTimer,
  stopTimer,
  updateTimer,
} from '../services/timer';

export function timerRouter(db: Db) {
  const router = Router();

  router.get('/', (_req, res) => {
    const body: TimerResponse = { timer: getTimer(db) };
    res.json(body);
  });

  router.patch('/', (req, res) => {
    const body: TimerResponse = { timer: updateTimer(db, parseBody(updateTimerSchema, req.body)) };
    res.json(body);
  });

  router.post('/start', (req, res) => {
    const body: TimerResponse = { timer: startTimer(db, parseBody(startTimerSchema, req.body)) };
    res.status(201).json(body);
  });

  router.post('/pause', (_req, res) => {
    const body: TimerResponse = { timer: pauseTimer(db) };
    res.json(body);
  });

  router.post('/resume', (_req, res) => {
    const body: TimerResponse = { timer: resumeTimer(db) };
    res.json(body);
  });

  router.post('/stop', (req, res) => {
    res.json(stopTimer(db, parseBody(stopTimerSchema, req.body)));
  });

  return router;
}
