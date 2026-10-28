import { createDb, runMigrations } from '../db/client';

/** A fresh, migrated in-memory database. */
export function createTestDb() {
  const db = createDb(':memory:');
  runMigrations(db);
  return db;
}
