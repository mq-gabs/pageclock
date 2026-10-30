import { pino } from 'pino';
import { config } from './config';

export const logger = pino({
  level: config.logLevel,
  // Bearer tokens must never reach the logs.
  redact: { paths: ['req.headers.authorization', 'req.headers.cookie'], censor: '[redacted]' },
});
