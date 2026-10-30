import { z } from 'zod';

export const userLimits = {
  nameMax: 100,
  nickMin: 3,
  nickMax: 30,
  passwordMin: 8,
  passwordMax: 128,
} as const;

const name = z
  .string()
  .trim()
  .min(1, 'Enter your name')
  .max(userLimits.nameMax, `Keep your name under ${userLimits.nameMax} characters`);

/** Nicks are case-insensitive: stored lowercase, so "Gabs" and "gabs" are the same nick. */
export const nickSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(userLimits.nickMin, `Use at least ${userLimits.nickMin} characters`)
  .max(userLimits.nickMax, `Use at most ${userLimits.nickMax} characters`)
  .regex(/^[a-z0-9_.]+$/, 'Use only letters, numbers, dots and underscores');

const password = z
  .string({ error: 'Enter a password' })
  .min(userLimits.passwordMin, `Use at least ${userLimits.passwordMin} characters`)
  .max(userLimits.passwordMax, `Use at most ${userLimits.passwordMax} characters`);

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  nick: z.string(),
  createdAt: z.iso.datetime(),
});
export type User = z.infer<typeof userSchema>;

export const signUpSchema = z.object({ name, nick: nickSchema, password });
export type SignUpInput = z.infer<typeof signUpSchema>;

/** Sign-in only checks that something was typed; a wrong nick or password is a 401. */
export const signInSchema = z.object({
  nick: z.string().trim().toLowerCase().min(1, 'Enter your nick'),
  password: z.string({ error: 'Enter your password' }).min(1, 'Enter your password'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const authResponseSchema = z.object({
  /** Send it as `Authorization: Bearer <token>`. */
  token: z.string(),
  user: userSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const meResponseSchema = z.object({ user: userSchema });
export type MeResponse = z.infer<typeof meResponseSchema>;

export const updateProfileSchema = z
  .object({ name, nick: nickSchema })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Send at least one field to change');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: 'Enter your current password' })
    .min(1, 'Enter your current password'),
  newPassword: password,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
