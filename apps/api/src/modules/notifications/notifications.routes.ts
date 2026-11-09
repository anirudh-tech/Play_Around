import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env';
import type { Database } from '../../lib/prisma';
import { createRequireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

export function createNotificationsRouter(env: Env, db: Database): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env, db);

  router.get('/notifications', requireAuth, async (req, res) => {
    const unreadOnly = req.query.unreadOnly === 'true';
    const rows = await db.notification.findMany({
      where: { userId: res.locals.auth!.id, readAt: unreadOnly ? null : undefined },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ data: rows });
  });

  router.get('/notifications/unread-count', requireAuth, async (_req, res) => {
    const count = await db.notification.count({
      where: { userId: res.locals.auth!.id, readAt: null },
    });
    res.json({ data: { count } });
  });

  router.patch(
    '/notifications/:id/read',
    requireAuth,
    validate({ params: z.object({ id: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      await db.notification.updateMany({
        where: { id: params.id, userId: res.locals.auth!.id },
        data: { readAt: new Date() },
      });
      res.status(204).send();
    },
  );

  router.post('/notifications/read-all', requireAuth, async (_req, res) => {
    await db.notification.updateMany({
      where: { userId: res.locals.auth!.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).send();
  });

  return router;
}
