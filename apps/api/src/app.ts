import express from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './logger';
import { errorHandler, notFound } from './middleware/errors';
import { healthRouter } from './routes/health';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use('/api/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
