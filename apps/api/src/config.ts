export const config = {
  port: Number(process.env.PORT ?? 3333),
  host: process.env.HOST ?? 'localhost',
  // Paths are relative to the api project, where Nx runs its targets.
  databaseUrl: process.env.DATABASE_URL ?? './data/reading-tracker.db',
  migrationsFolder: process.env.MIGRATIONS_DIR ?? './drizzle',
  appTimezone: process.env.APP_TIMEZONE ?? 'America/Fortaleza',
  logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
};
