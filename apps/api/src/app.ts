import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Db } from './db/client';
import { logger } from './logger';
import { requireAuth } from './middleware/auth';
import { errorHandler, notFound } from './middleware/errors';
import { authRouter, meRouter } from './routes/auth';
import { booksRouter } from './routes/books';
import { healthRouter } from './routes/health';
import { sessionsRouter } from './routes/sessions';
import { statsRouter } from './routes/stats';
import { timerRouter } from './routes/timer';

export interface AppDeps {
  db: Db;
}

export function createApp({ db }: AppDeps) {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(express.json());

  // Public routes.
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter(db));

  // Everything else needs `Authorization: Bearer <token>`.
  const auth = requireAuth(db);
  app.use('/api/me', auth, meRouter(db));
  app.use('/api/books', auth, booksRouter(db));
  app.use('/api/reading-sessions', auth, sessionsRouter(db));
  app.use('/api/timer', auth, timerRouter(db));
  app.use('/api/stats', auth, statsRouter(db));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
