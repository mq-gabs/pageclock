import { describe, expect, it } from 'vitest';
import {
  changePasswordSchema,
  nickSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from './auth';

describe('nickSchema', () => {
  it('trims and lowercases', () => {
    expect(nickSchema.parse('  Gabs_92 ')).toBe('gabs_92');
  });

  it('accepts the length limits', () => {
    expect(nickSchema.safeParse('abc').success).toBe(true);
    expect(nickSchema.safeParse('a'.repeat(30)).success).toBe(true);
  });

  it.each(['ab', 'a'.repeat(31), 'with space', 'émile', 'a-b', ''])('rejects %j', (nick) => {
    expect(nickSchema.safeParse(nick).success).toBe(false);
  });
});

describe('signUpSchema', () => {
  it('accepts a valid account and trims the name', () => {
    expect(signUpSchema.parse({ name: ' Ana ', nick: 'Ana', password: 'longenough' })).toEqual({
      name: 'Ana',
      nick: 'ana',
      password: 'longenough',
    });
  });

  it('keeps the password as typed', () => {
    expect(signUpSchema.parse({ name: 'A', nick: 'ana', password: ' spaces ok ' }).password).toBe(
      ' spaces ok ',
    );
  });

  it('rejects a short password and an empty name', () => {
    const result = signUpSchema.safeParse({ name: ' ', nick: 'ana', password: 'short' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual(['name', 'password']);
  });
});

describe('signInSchema', () => {
  it('lowercases the nick and needs both fields', () => {
    expect(signInSchema.parse({ nick: 'ANA', password: 'x' })).toEqual({
      nick: 'ana',
      password: 'x',
    });
    expect(signInSchema.safeParse({ nick: '', password: '' }).success).toBe(false);
  });
});

describe('updateProfileSchema', () => {
  it('accepts one field', () => {
    expect(updateProfileSchema.parse({ nick: 'New.Nick' })).toEqual({ nick: 'new.nick' });
  });

  it('rejects an empty update', () => {
    expect(updateProfileSchema.safeParse({}).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('needs the current password and a valid new one', () => {
    expect(
      changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'newpassword' })
        .success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({ currentPassword: '', newPassword: 'short' }).success,
    ).toBe(false);
  });
});
