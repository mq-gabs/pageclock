import { config } from '../config';
import { logger } from '../logger';
import { createDb, runMigrations } from './client';

const db = createDb();
runMigrations(db);
logger.info(`Migrated ${config.databaseUrl}`);
db.$client.close();
