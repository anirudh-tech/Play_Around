import {
  ConfirmPaymentBody,
  OpenDisputeBody,
  PaymentIdParams,
  PaymentStatus,
  RefundPaymentBody,
  RejectReportBody,
  ReportPaymentBody,
  RetractReportBody,
  SessionIdParams,
  WaivePaymentBody,
} from '@playaround/contracts';
import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env';
import type { Database } from '../../lib/prisma';
import { createRequireAuth } from '../../middleware/auth';
import { requireIdempotency } from '../../middleware/idempotency';
import { validate } from '../../middleware/validate';
import * as payments from './payment.service';

export function createPaymentsRouter(env: Env, db: Database, now: () => Date): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env, db);
  const idemp = requireIdempotency(db);
  const ctx = () => ({ db, now });

  router.get('/me/payments', requireAuth, async (req, res) => {
    const role = req.query.role === 'payee' ? 'payee' : 'payer';
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const parsed = statusRaw ? PaymentStatus.safeParse(statusRaw) : undefined;
    const status = parsed?.success ? parsed.data : undefined;
    res.json({ data: await payments.listMine(ctx(), res.locals.auth!.id, role, status) });
  });

  router.get(
    '/sessions/:id/payments',
    requireAuth,
    validate({ params: SessionIdParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      res.json({ data: await payments.sessionOverview(ctx(), params.id, res.locals.auth!.id) });
    },
  );

  router.post(
    '/sessions/:id/payments/remind',
    requireAuth,
    idemp,
    validate({ params: SessionIdParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      res.json({ data: await payments.remindUnpaid(ctx(), params.id, res.locals.auth!.id) });
    },
  );

  router.get('/payments/:id', requireAuth, validate({ params: PaymentIdParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    const auth = res.locals.auth!;
    const staff = auth.scope === 'admin';
    res.json({ data: await payments.getPayment(ctx(), params.id, auth.id, staff) });
  });

  router.post(
    '/payments/:id/report',
    requireAuth,
    idemp,
    validate({ params: PaymentIdParams, body: ReportPaymentBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as ReportPaymentBody;
      res.json({ data: await payments.reportPayment(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.post(
    '/payments/:id/retract-report',
    requireAuth,
    idemp,
    validate({ params: PaymentIdParams, body: RetractReportBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = (res.locals.validated!.body ?? {}) as RetractReportBody;
      res.json({ data: await payments.retractReport(ctx(), params.id, res.locals.auth!.id, body.expectedVersion) });
    },
  );

  router.post(
    '/payments/:id/confirm',
    requireAuth,
    idemp,
    validate({ params: PaymentIdParams, body: ConfirmPaymentBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = (res.locals.validated!.body ?? {}) as ConfirmPaymentBody;
      res.json({ data: await payments.confirmPayment(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.post(
    '/payments/:id/reject-report',
    requireAuth,
    idemp,
    validate({ params: PaymentIdParams, body: RejectReportBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as RejectReportBody;
      res.json({ data: await payments.rejectReport(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.post(
    '/payments/:id/waive',
    requireAuth,
    idemp,
    validate({ params: PaymentIdParams, body: WaivePaymentBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = (res.locals.validated!.body ?? {}) as WaivePaymentBody;
      res.json({
        data: await payments.waivePayment(ctx(), params.id, res.locals.auth!.id, body.note, body.expectedVersion),
      });
    },
  );

  router.post(
    '/payments/:id/refund',
    requireAuth,
    idemp,
    validate({ params: PaymentIdParams, body: RefundPaymentBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as RefundPaymentBody;
      res.json({ data: await payments.refundPayment(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.post(
    '/payments/:id/disputes',
    requireAuth,
    idemp,
    validate({ params: PaymentIdParams, body: OpenDisputeBody }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as OpenDisputeBody;
      res.json({ data: await payments.openDispute(ctx(), params.id, res.locals.auth!.id, body) });
    },
  );

  router.post(
    '/payment-disputes/:id/withdraw',
    requireAuth,
    idemp,
    validate({ params: z.object({ id: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      res.json({ data: await payments.withdrawDispute(ctx(), params.id, res.locals.auth!.id) });
    },
  );

  return router;
}
