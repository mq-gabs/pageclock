import { createApp } from './app';
import { config } from './config';
import { logger } from './logger';

const server = createApp().listen(config.port, config.host, () => {
  logger.info(`API listening on http://${config.host}:${config.port}/api`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
