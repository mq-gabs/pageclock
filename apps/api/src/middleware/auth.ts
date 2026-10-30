import type { Request, RequestHandler } from 'express';
import type { Db } from '../db/client';
import { authenticate, hashToken } from '../services/auth';
import { HttpError } from './errors';

export interface Auth {
  userId: string;
  tokenHash: string;
}

const auths = new WeakMap<Request, Auth>();

const unauthorized = () => new HttpError(401, 'unauthorized', 'Sign in to continue');

/** Rejects the request with 401 unless it has a valid `Authorization: Bearer <token>`. */
export function requireAuth(db: Db): RequestHandler {
  return (req, res, next) => {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(req.get('authorization') ?? '');
    const token = match?.[1];
    const user = token ? authenticate(db, token) : null;
    if (!token || !user) {
      res.set('WWW-Authenticate', 'Bearer');
      next(unauthorized());
      return;
    }
    auths.set(req, { userId: user.id, tokenHash: hashToken(token) });
    next();
  };
}

/** The signed-in user of a request that passed `requireAuth`. */
export function authOf(req: Request): Auth {
  const auth = auths.get(req);
  if (!auth) throw unauthorized();
  return auth;
}

export const userIdOf = (req: Request) => authOf(req).userId;
