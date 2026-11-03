import { Router } from 'express';
import { backupSchema, type ImportBackupResponse } from '@reading-tracker/shared';
import type { Db } from '../db/client';
import { userIdOf } from '../middleware/auth';
import { parseBodyByPath } from '../middleware/validate';
import { exportBackup, importBackup } from '../services/backup';

export function backupRouter(db: Db) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json(exportBackup(db, userIdOf(req)));
  });

  router.post('/', (req, res) => {
    const backup = parseBodyByPath(backupSchema, req.body);
    const body: ImportBackupResponse = importBackup(db, userIdOf(req), backup);
    res.json(body);
  });

  return router;
}
