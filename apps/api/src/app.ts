import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Db } from './db/client';
import { logger } from './logger';
import { errorHandler, notFound } from './middleware/errors';
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

  app.use('/api/health', healthRouter);
  app.use('/api/books', booksRouter(db));
  app.use('/api/reading-sessions', sessionsRouter(db));
  app.use('/api/timer', timerRouter(db));
  app.use('/api/stats', statsRouter(db));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
