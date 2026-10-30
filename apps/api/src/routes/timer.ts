import { Router } from 'express';
import {
  startTimerSchema,
  stopTimerSchema,
  updateTimerSchema,
  type TimerResponse,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { userIdOf } from '../middleware/auth';
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

  router.get('/', (req, res) => {
    const body: TimerResponse = { timer: getTimer(db, userIdOf(req)) };
    res.json(body);
  });

  router.patch('/', (req, res) => {
    const body: TimerResponse = {
      timer: updateTimer(db, userIdOf(req), parseBody(updateTimerSchema, req.body)),
    };
    res.json(body);
  });

  router.post('/start', (req, res) => {
    const body: TimerResponse = {
      timer: startTimer(db, userIdOf(req), parseBody(startTimerSchema, req.body)),
    };
    res.status(201).json(body);
  });

  router.post('/pause', (req, res) => {
    const body: TimerResponse = { timer: pauseTimer(db, userIdOf(req)) };
    res.json(body);
  });

  router.post('/resume', (req, res) => {
    const body: TimerResponse = { timer: resumeTimer(db, userIdOf(req)) };
    res.json(body);
  });

  router.post('/stop', (req, res) => {
    res.json(stopTimer(db, userIdOf(req), parseBody(stopTimerSchema, req.body)));
  });

  return router;
}
