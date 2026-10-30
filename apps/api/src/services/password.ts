import { randomBytes, scrypt, scryptSync, timingSafeEqual, type BinaryLike } from 'node:crypto';

const keyLength = 64;

const scryptAsync = (password: BinaryLike, salt: BinaryLike) =>
  new Promise<Buffer>((resolve, reject) =>
    scrypt(password, salt, keyLength, (err, key) => (err ? reject(err) : resolve(key))),
  );

const format = (salt: Buffer, key: Buffer) =>
  `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;

/** Hashes with scrypt and a random salt, as `scrypt$<salt>$<hash>`. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return format(salt, await scryptAsync(password, salt));
}

/** For the seed script, which runs synchronously. */
export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  return format(salt, scryptSync(password, salt, keyLength));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
