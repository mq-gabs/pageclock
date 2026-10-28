export const config = {
  port: Number(process.env.PORT ?? 3333),
  host: process.env.HOST ?? 'localhost',
  appTimezone: process.env.APP_TIMEZONE ?? 'America/Fortaleza',
  logLevel: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
};
