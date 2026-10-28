import { createApp } from './app';
import { config } from './config';
import { createDb } from './db/client';
import { logger } from './logger';

const db = createDb();

const server = createApp({ db }).listen(config.port, config.host, () => {
  logger.info(`API listening on http://${config.host}:${config.port}/api`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () =>
    server.close(() => {
      db.$client.close();
      process.exit(0);
    }),
  );
}
