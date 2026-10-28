import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { config } from '../config';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
/** For helpers that run both inside and outside a transaction. */
export type DbOrTx = Db | Tx;

/** Opens a SQLite database (a file path or ':memory:') with foreign keys on. */
export function createDb(url: string = config.databaseUrl): Db {
  if (url !== ':memory:') mkdirSync(dirname(url), { recursive: true });
  const sqlite = new Database(url);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return drizzle(sqlite, { schema });
}

export function runMigrations(db: Db) {
  migrate(db, { migrationsFolder: config.migrationsFolder });
}
