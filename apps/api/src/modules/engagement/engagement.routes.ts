import { ReportBody, ReviewBody, SessionIdParams } from '@playaround/contracts';
import { Router } from 'express';
import { AppError } from '../../lib/errors';
import { emitAdminFeed } from '../../lib/realtime';
import { notify } from '../../lib/notify';
import type { Env } from '../../config/env';
import type { Database } from '../../lib/prisma';
import { createRequireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';

export function createEngagementRouter(env: Env, db: Database, now: () => Date): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env, db);

  router.post(
    '/sessions/:id/reviews',
    requireAuth,
    validate({ params: SessionIdParams, body: ReviewBody }),
    async (_req, res) => {
      const { id } = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as ReviewBody;
      const userId = res.locals.auth!.id;
      const session = await db.session.findUnique({ where: { id }, include: { participants: true } });
      if (!session || session.status !== 'COMPLETED') {
        throw new AppError('INVALID_STATE_TRANSITION', 'Reviews are only for completed sessions.');
      }
      const window = new Date(session.endsAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      if (now() > window) throw new AppError('DEADLINE_PASSED', 'The review window has closed.');
      const mine = session.participants.find((p) => p.userId === userId && p.status !== 'CANCELLED');
      const theirs = session.participants.find((p) => p.userId === body.revieweeId && p.status !== 'CANCELLED');
      if (!mine || !theirs || body.revieweeId === userId) {
        throw new AppError('FORBIDDEN', 'You can only review co-participants.');
      }
      const review = await db.review.create({
        data: {
          sessionId: id,
          reviewerId: userId,
          revieweeId: body.revieweeId,
          rating: body.rating,
          comment: body.comment,
        },
      });
      const agg = await db.review.aggregate({
        where: { revieweeId: body.revieweeId, isHidden: false },
        _avg: { rating: true },
        _count: true,
      });
      await db.userProfile.update({
        where: { userId: body.revieweeId },
        data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
      });
      await notify(db, {
        userId: body.revieweeId,
        type: 'REVIEW_RECEIVED',
        title: 'New review',
        body: 'Someone left you a review.',
        sessionId: id,
        actorId: userId,
      });
      res.status(201).json({ data: review });
    },
  );

  router.post('/reports', requireAuth, validate({ body: ReportBody }), async (_req, res) => {
    const body = res.locals.validated!.body as ReportBody;
    const report = await db.report.create({
      data: {
        reporterId: res.locals.auth!.id,
        targetType: body.targetType,
        targetId: body.targetId,
        reason: body.reason,
        details: body.details,
      },
    });
    emitAdminFeed({
      kind: 'report',
      refId: report.id,
      summary: `${body.targetType} reported`,
    });
    res.status(201).json({ data: report });
  });

  return router;
}
