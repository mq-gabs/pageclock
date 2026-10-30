import { Router } from 'express';
import {
  changePasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
  type MeResponse,
} from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { authOf, requireAuth, userIdOf } from '../middleware/auth';
import { parseBody } from '../middleware/validate';
import { changePassword, getMe, signIn, signOut, signUp, updateProfile } from '../services/auth';

/** Public: sign up and sign in. Sign out needs the token it ends. */
export function authRouter(db: Db) {
  const router = Router();

  router.post('/sign-up', async (req, res) => {
    res.status(201).json(await signUp(db, parseBody(signUpSchema, req.body)));
  });

  router.post('/sign-in', async (req, res) => {
    res.json(await signIn(db, parseBody(signInSchema, req.body)));
  });

  router.post('/sign-out', requireAuth(db), (req, res) => {
    signOut(db, authOf(req).tokenHash);
    res.status(204).end();
  });

  return router;
}

/** The signed-in user's account. Mounted behind `requireAuth`. */
export function meRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    const body: MeResponse = { user: getMe(db, userIdOf(req)) };
    res.json(body);
  });

  router.patch('/', (req, res) => {
    const body: MeResponse = {
      user: updateProfile(db, userIdOf(req), parseBody(updateProfileSchema, req.body)),
    };
    res.json(body);
  });

  router.put('/password', async (req, res) => {
    const { userId, tokenHash } = authOf(req);
    await changePassword(db, userId, tokenHash, parseBody(changePasswordSchema, req.body));
    res.status(204).end();
  });

  return router;
}
