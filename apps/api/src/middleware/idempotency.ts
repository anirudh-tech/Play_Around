import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { AppError } from '../lib/errors';
import type { Database } from '../lib/prisma';

function hashBody(body: unknown): string {
  return createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}

/**
 * Replay-safe mutations. Attach to routes that require `Idempotency-Key`
 * (sessions, payments, venue actions, admin mutations).
 */
export function requireIdempotency(db: Database): RequestHandler {
  return async (req, res, next) => {
    try {
      const key = req.headers['idempotency-key'];
      if (typeof key !== 'string' || key.length < 8 || key.length > 64) {
        throw new AppError('VALIDATION_ERROR', 'Idempotency-Key header required.');
      }
      const userId = res.locals.auth?.id;
      if (!userId) throw new AppError('UNAUTHENTICATED', 'Sign in required.');
      const requestHash = hashBody(req.body);
      const existing = await db.idempotencyKey.findUnique({
        where: { userId_key: { userId, key } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new AppError('IDEMPOTENCY_KEY_REUSED', 'Idempotency key was used with a different body.');
        }
        if (existing.statusCode && existing.responseBody != null) {
          res.status(existing.statusCode).json(existing.responseBody);
          return;
        }
      } else {
        await db.idempotencyKey.create({
          data: {
            userId,
            key,
            method: req.method,
            path: req.path,
            requestHash,
            lockedUntil: new Date(Date.now() + 30_000),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        void db.idempotencyKey.update({
          where: { userId_key: { userId, key } },
          data: { statusCode: res.statusCode, responseBody: body as object },
        });
        return originalJson(body);
      }) as typeof res.json;
      next();
    } catch (error) {
      next(error);
    }
  };
}
