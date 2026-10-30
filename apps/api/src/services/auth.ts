import { createHash, randomBytes } from 'node:crypto';
import { and, eq, lte, ne } from 'drizzle-orm';
import type {
  AuthResponse,
  ChangePasswordInput,
  SignInInput,
  SignUpInput,
  UpdateProfileInput,
  User,
} from '@reading-tracker/shared';
import type { Db, DbOrTx } from '../db/client';
import { authTokens, users, type UserRow } from '../db/schema';
import { HttpError } from '../middleware/errors';
import { hashPassword, verifyPassword } from './password';

/** How long a token stays valid after sign-in. */
export const tokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function toUser(row: UserRow): User {
  return { id: row.id, name: row.name, nick: row.nick, createdAt: row.createdAt.toISOString() };
}

const nickTaken = () =>
  new HttpError(409, 'nick_taken', 'That nick is taken', { nick: ['That nick is taken'] });

const isUniqueViolation = (err: unknown) =>
  err instanceof Error && 'code' in err && err.code === 'SQLITE_CONSTRAINT_UNIQUE';

function assertNickFree(db: DbOrTx, nick: string, exceptUserId?: string) {
  const row = db
    .select({ id: users.id })
    .from(users)
    .where(
      exceptUserId ? and(eq(users.nick, nick), ne(users.id, exceptUserId)) : eq(users.nick, nick),
    )
    .get();
  if (row) throw nickTaken();
}

/** Creates a token for the user; only its hash is stored. */
export function issueToken(db: DbOrTx, userId: string, now = new Date()): string {
  const token = randomBytes(32).toString('base64url');
  db.insert(authTokens)
    .values({
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(now.getTime() + tokenLifetimeMs),
      createdAt: now,
    })
    .run();
  return token;
}

export async function signUp(db: Db, input: SignUpInput, now = new Date()): Promise<AuthResponse> {
  assertNickFree(db, input.nick);
  const passwordHash = await hashPassword(input.password);
  try {
    return db.transaction((tx) => {
      const row = tx
        .insert(users)
        .values({ name: input.name, nick: input.nick, passwordHash })
        .returning()
        .get();
      return { token: issueToken(tx, row.id, now), user: toUser(row) };
    });
  } catch (err) {
    // Someone took the nick while the password was hashing.
    if (isUniqueViolation(err)) throw nickTaken();
    throw err;
  }
}

// Compared against when the nick doesn't exist, so a wrong nick takes as long as a wrong password.
const dummyHash = hashPassword('not-a-real-password');

export async function signIn(db: Db, input: SignInInput, now = new Date()): Promise<AuthResponse> {
  const row = db.select().from(users).where(eq(users.nick, input.nick)).get();
  const valid = await verifyPassword(input.password, row?.passwordHash ?? (await dummyHash));
  if (!row || !valid) {
    throw new HttpError(401, 'invalid_credentials', 'Wrong nick or password');
  }
  return { token: issueToken(db, row.id, now), user: toUser(row) };
}

export function signOut(db: Db, tokenHash: string) {
  db.delete(authTokens).where(eq(authTokens.tokenHash, tokenHash)).run();
}

/** The user a bearer token belongs to, or null when it's unknown or expired. */
export function authenticate(db: Db, token: string, now = new Date()): UserRow | null {
  const tokenHash = hashToken(token);
  const found = db
    .select({ user: users, expiresAt: authTokens.expiresAt })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .where(eq(authTokens.tokenHash, tokenHash))
    .get();
  if (!found) return null;
  if (found.expiresAt <= now) {
    db.delete(authTokens).where(lte(authTokens.expiresAt, now)).run();
    return null;
  }
  return found.user;
}

function findUserRow(db: DbOrTx, id: string): UserRow {
  const row = db.select().from(users).where(eq(users.id, id)).get();
  if (!row) throw new HttpError(401, 'unauthorized', 'Sign in to continue');
  return row;
}

export function getMe(db: Db, userId: string): User {
  return toUser(findUserRow(db, userId));
}

export function updateProfile(
  db: Db,
  userId: string,
  input: UpdateProfileInput,
  now = new Date(),
): User {
  try {
    return db.transaction((tx) => {
      findUserRow(tx, userId);
      if (input.nick !== undefined) assertNickFree(tx, input.nick, userId);
      const row = tx
        .update(users)
        .set({ ...input, updatedAt: now })
        .where(eq(users.id, userId))
        .returning()
        .get();
      return toUser(row);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw nickTaken();
    throw err;
  }
}

/**
 * Checks the current password, stores the new one and signs out every other device;
 * the token that made the request stays valid.
 */
export async function changePassword(
  db: Db,
  userId: string,
  currentTokenHash: string,
  input: ChangePasswordInput,
  now = new Date(),
) {
  const row = findUserRow(db, userId);
  if (!(await verifyPassword(input.currentPassword, row.passwordHash))) {
    throw new HttpError(400, 'validation_error', 'The current password is wrong', {
      currentPassword: ['The current password is wrong'],
    });
  }
  const passwordHash = await hashPassword(input.newPassword);
  db.transaction((tx) => {
    tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, userId)).run();
    tx.delete(authTokens)
      .where(and(eq(authTokens.userId, userId), ne(authTokens.tokenHash, currentTokenHash)))
      .run();
  });
}
