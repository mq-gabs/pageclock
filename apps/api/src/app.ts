import express from 'express';
import { pinoHttp } from 'pino-http';
import type { Db } from './db/client';
import { logger } from './logger';
import { errorHandler, notFound } from './middleware/errors';
import { booksRouter } from './routes/books';
import { healthRouter } from './routes/health';

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

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
