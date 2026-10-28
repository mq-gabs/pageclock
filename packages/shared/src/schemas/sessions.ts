import { z } from 'zod';

export const sessionSources = ['timer', 'manual'] as const;
export const sessionSourceSchema = z.enum(sessionSources);
export type SessionSource = z.infer<typeof sessionSourceSchema>;
