import {
  AdminCorrectStatusBody,
  AdminCreateVenueBody,
  AdminHideReviewBody,
  AdminMergeVenueBody,
  AdminPatchReportBody,
  AdminPatchSettingBody,
  AdminPatchSportBody,
  AdminPatchVenueBody,
  AdminPaymentActionBody,
  AdminProposeVenueOptionBody,
  AdminReasonBody,
  AdminRefundBody,
  AdminSportBody,
  AdminStaffRoleBody,
  AdminUserStatusBody,
  AdminVenueBookingBody,
  AdminWaiveBody,
  AssignArrangementBody,
  PatchArrangementBody,
  PatchVenueOptionBody,
  ResolveDisputeBody,
  SettingKeyParam,
  VenueArrangementStatus,
} from '@playaround/contracts';
import { Router } from 'express';
import { z } from 'zod';
import type { Env } from '../../config/env';
import type { Database } from '../../lib/prisma';
import { createRequireAuth, requireAdminScope, requireRole, requireStaff } from '../../middleware/auth';
import { requireIdempotency } from '../../middleware/idempotency';
import { validate } from '../../middleware/validate';
import * as payments from '../payments/payment.service';
import * as directory from './admin.directory';
import * as admin from './admin.service';

export function createAdminOpsRouter(env: Env, db: Database, now: () => Date): Router {
  const router = Router();
  const requireAuth = createRequireAuth(env, db);
  const idemp = requireIdempotency(db);
  const staff = [requireAuth, requireStaff, requireAdminScope] as const;
  const ops = [...staff, requireRole('OPERATIONS', 'SUPER_ADMIN')] as const;
  const support = [...staff, requireRole('SUPPORT', 'SUPER_ADMIN')] as const;
  const ctx = () => ({ db, now });

  router.get('/venue-arrangements', ...ops, async (req, res) => {
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    const status = statusRaw ? VenueArrangementStatus.parse(statusRaw) : undefined;
    const assignee = typeof req.query.assignee === 'string' ? req.query.assignee : undefined;
    res.json({ data: await admin.listArrangements(db, { status, assignee }) });
  });

  router.get(
    '/venue-arrangements/:id',
    ...ops,
    validate({ params: z.object({ id: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      res.json({ data: await admin.getArrangement(db, params.id) });
    },
  );

  router.post(
    '/venue-arrangements/:id/assign',
    ...ops,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AssignArrangementBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AssignArrangementBody;
      const data = await admin.assignArrangement(db, params.id, body.assigneeId);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue_arrangement.assign',
        targetType: 'venue_arrangement',
        targetId: params.id,
        reason: body.reason,
        after: { assignedToId: body.assigneeId },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.patch(
    '/venue-arrangements/:id',
    ...ops,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: PatchArrangementBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as PatchArrangementBody;
      const data = await admin.patchArrangement(db, params.id, body);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue_arrangement.patch',
        targetType: 'venue_arrangement',
        targetId: params.id,
        reason: body.reason,
        after: body,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.post(
    '/venue-arrangements/:id/options',
    ...ops,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AdminProposeVenueOptionBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminProposeVenueOptionBody;
      const data = await admin.addArrangementOption(ctx(), params.id, res.locals.auth!.id, body);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue_option.create',
        targetType: 'venue_arrangement',
        targetId: params.id,
        reason: body.reason,
        after: { venueId: body.venueId },
        ipAddress: req.ip,
      });
      res.status(201).json({ data });
    },
  );

  router.patch(
    '/venue-options/:id',
    ...ops,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: PatchVenueOptionBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as PatchVenueOptionBody;
      const data = await admin.patchVenueOption(db, params.id, body);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue_option.patch',
        targetType: 'venue_option',
        targetId: params.id,
        reason: body.reason,
        after: body,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.delete(
    '/venue-options/:id',
    ...ops,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AdminReasonBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as { reason: string };
      await admin.withdrawVenueOption(db, params.id);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue_option.withdraw',
        targetType: 'venue_option',
        targetId: params.id,
        reason: body.reason,
        ipAddress: req.ip,
      });
      res.status(204).send();
    },
  );

  router.post(
    '/sessions/:id/venue-booking',
    ...ops,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AdminVenueBookingBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminVenueBookingBody;
      const data = await admin.staffRecordBooking(ctx(), params.id, res.locals.auth!.id, body);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue_booking.record',
        targetType: 'session',
        targetId: params.id,
        reason: body.reason,
        after: { venueOptionId: body.venueOptionId },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/payments', ...staff, async (req, res) => {
    const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({
      data: await payments.listAdminPayments(ctx(), statusRaw ? paymentsStatus(statusRaw) : undefined),
    });
  });

  router.get('/payments/:id', ...staff, validate({ params: z.object({ id: z.uuid() }) }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    res.json({ data: await payments.getPayment(ctx(), params.id, res.locals.auth!.id, true) });
  });

  router.post(
    '/payments/:id/confirm',
    ...support,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AdminPaymentActionBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminPaymentActionBody;
      const data = await payments.confirmPayment(ctx(), params.id, res.locals.auth!.id, body, true);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'payment.confirm',
        targetType: 'payment',
        targetId: params.id,
        reason: body.reason,
        after: data,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.post(
    '/payments/:id/waive',
    ...support,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AdminWaiveBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminWaiveBody;
      const data = await payments.waivePayment(ctx(), params.id, res.locals.auth!.id, body.note, body.expectedVersion, true);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'payment.waive',
        targetType: 'payment',
        targetId: params.id,
        reason: body.reason,
        after: data,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.post(
    '/payments/:id/refund',
    ...support,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AdminRefundBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminRefundBody;
      const data = await payments.refundPayment(ctx(), params.id, res.locals.auth!.id, body, true);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'payment.refund',
        targetType: 'payment',
        targetId: params.id,
        reason: body.reason,
        after: data,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.post(
    '/payments/:id/correct-status',
    ...support,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: AdminCorrectStatusBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminCorrectStatusBody;
      const data = await payments.correctStatus(
        ctx(),
        params.id,
        res.locals.auth!.id,
        body.status,
        body.note,
        body.expectedVersion,
      );
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'payment.correct_status',
        targetType: 'payment',
        targetId: params.id,
        reason: body.reason,
        after: { status: body.status },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/payment-disputes', ...staff, async (req, res) => {
    const status = req.query.status === 'OPEN' || req.query.status === 'RESOLVED' || req.query.status === 'WITHDRAWN'
      ? req.query.status
      : undefined;
    res.json({ data: await payments.listAdminDisputes(ctx(), status) });
  });

  router.get(
    '/payment-disputes/:id',
    ...staff,
    validate({ params: z.object({ id: z.uuid() }) }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { id: string };
      res.json({ data: await payments.getAdminDispute(ctx(), params.id) });
    },
  );

  router.post(
    '/payment-disputes/:id/resolve',
    ...support,
    idemp,
    validate({ params: z.object({ id: z.uuid() }), body: ResolveDisputeBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as ResolveDisputeBody;
      const data = await payments.resolveDispute(
        ctx(),
        params.id,
        res.locals.auth!.id,
        body.resolutionStatus,
        body.note,
      );
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'payment_dispute.resolve',
        targetType: 'payment_dispute',
        targetId: params.id,
        reason: body.reason ?? body.note,
        after: { resolutionStatus: body.resolutionStatus },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  const superAdmin = [...staff, requireRole('SUPER_ADMIN')] as const;
  const UuidParams = z.object({ id: z.uuid() });
  const SportParams = z.object({ id: z.coerce.number().int().positive() });

  router.get('/metrics', ...staff, async (_req, res) => {
    res.json({ data: await directory.overviewMetrics(db, now()) });
  });

  router.get('/staff', ...ops, async (_req, res) => {
    res.json({ data: await directory.listStaff(db) });
  });

  router.get('/users', ...staff, async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({ data: await directory.listUsers(db, { q, role, status }) });
  });

  router.get('/users/:id', ...staff, validate({ params: UuidParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    res.json({ data: await directory.getUser(db, params.id) });
  });

  router.post(
    '/users/:id/status',
    ...ops,
    idemp,
    validate({ params: UuidParams, body: AdminUserStatusBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminUserStatusBody;
      const data = await directory.setUserStatus(db, res.locals.auth!, params.id, body.status);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: body.status === 'SUSPENDED' ? 'user.suspend' : 'user.reactivate',
        targetType: 'user',
        targetId: params.id,
        reason: body.reason,
        after: { status: body.status },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.post(
    '/users/:id/role',
    ...superAdmin,
    idemp,
    validate({ params: UuidParams, body: AdminStaffRoleBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminStaffRoleBody;
      const data = await directory.setStaffRole(db, res.locals.auth!.id, params.id, body.role);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'user.role',
        targetType: 'user',
        targetId: params.id,
        reason: body.reason,
        after: { role: body.role },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/sessions', ...staff, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ data: await directory.listAdminSessions(db, { status, type, q }) });
  });

  router.get('/sessions/:id', ...staff, validate({ params: UuidParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    res.json({ data: await directory.getAdminSession(db, params.id) });
  });

  router.post(
    '/sessions/:id/cancel',
    ...ops,
    idemp,
    validate({ params: UuidParams, body: AdminReasonBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as { reason: string };
      const data = await directory.adminCancelSession(ctx(), params.id, res.locals.auth!.id, body.reason);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'session.cancel',
        targetType: 'session',
        targetId: params.id,
        reason: body.reason,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.post(
    '/sessions/:id/participants/:userId/remove',
    ...staff,
    idemp,
    validate({ params: z.object({ id: z.uuid(), userId: z.uuid() }), body: AdminReasonBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string; userId: string };
      const body = res.locals.validated!.body as { reason: string };
      await directory.adminRemoveParticipant(ctx(), params.id, res.locals.auth!.id, params.userId);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'session.remove_participant',
        targetType: 'session',
        targetId: params.id,
        reason: body.reason,
        after: { userId: params.userId },
        ipAddress: req.ip,
      });
      res.status(204).send();
    },
  );

  router.get('/sports', ...ops, async (_req, res) => {
    res.json({ data: await directory.listAdminSports(db) });
  });

  router.post('/sports', ...ops, idemp, validate({ body: AdminSportBody }), async (req, res) => {
    const body = res.locals.validated!.body as AdminSportBody;
    const data = await directory.createSport(db, body);
    await admin.audit(db, {
      actorId: res.locals.auth!.id,
      action: 'sport.create',
      targetType: 'sport',
      targetId: String(data.id),
      reason: body.reason,
      after: data,
      ipAddress: req.ip,
    });
    res.status(201).json({ data });
  });

  router.patch(
    '/sports/:id',
    ...ops,
    idemp,
    validate({ params: SportParams, body: AdminPatchSportBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: number };
      const body = res.locals.validated!.body as AdminPatchSportBody;
      const data = await directory.patchSport(db, params.id, body);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'sport.patch',
        targetType: 'sport',
        targetId: String(params.id),
        reason: body.reason,
        after: body,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/venues', ...ops, async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    res.json({ data: await directory.listAdminVenues(db, q) });
  });

  router.get('/venues/:id', ...ops, validate({ params: UuidParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    res.json({ data: await directory.getAdminVenue(db, params.id) });
  });

  router.post('/venues', ...ops, idemp, validate({ body: AdminCreateVenueBody }), async (req, res) => {
    const body = res.locals.validated!.body as AdminCreateVenueBody;
    const data = await directory.createAdminVenue(db, res.locals.auth!.id, body);
    await admin.audit(db, {
      actorId: res.locals.auth!.id,
      action: 'venue.create',
      targetType: 'venue',
      targetId: data.id,
      reason: body.reason,
      after: data,
      ipAddress: req.ip,
    });
    res.status(201).json({ data });
  });

  router.patch(
    '/venues/:id',
    ...ops,
    idemp,
    validate({ params: UuidParams, body: AdminPatchVenueBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminPatchVenueBody;
      const data = await directory.patchAdminVenue(db, params.id, body);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue.patch',
        targetType: 'venue',
        targetId: params.id,
        reason: body.reason,
        after: body,
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.post(
    '/venues/:id/merge',
    ...ops,
    idemp,
    validate({ params: UuidParams, body: AdminMergeVenueBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminMergeVenueBody;
      const data = await directory.mergeVenues(db, params.id, body.intoVenueId);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'venue.merge',
        targetType: 'venue',
        targetId: params.id,
        reason: body.reason,
        after: { intoVenueId: body.intoVenueId },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/reports', ...staff, async (req, res) => {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    res.json({ data: await directory.listReports(db, status) });
  });

  router.patch(
    '/reports/:id',
    ...staff,
    idemp,
    validate({ params: UuidParams, body: AdminPatchReportBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminPatchReportBody;
      const data = await directory.patchReport(db, params.id, res.locals.auth!.id, body);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'report.resolve',
        targetType: 'report',
        targetId: params.id,
        reason: body.reason,
        after: { status: body.status },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/reviews', ...staff, async (req, res) => {
    const hidden = req.query.hidden === 'true' ? true : req.query.hidden === 'false' ? false : undefined;
    res.json({ data: await directory.listReviews(db, hidden) });
  });

  router.post(
    '/reviews/:id/hide',
    ...staff,
    idemp,
    validate({ params: UuidParams, body: AdminHideReviewBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { id: string };
      const body = res.locals.validated!.body as AdminHideReviewBody;
      const data = await directory.hideReview(db, params.id, body.isHidden);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'review.hide',
        targetType: 'review',
        targetId: params.id,
        reason: body.reason,
        after: { isHidden: body.isHidden },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/settings', ...superAdmin, async (_req, res) => {
    res.json({ data: await directory.getSettings(db) });
  });

  router.put(
    '/settings/:key',
    ...superAdmin,
    idemp,
    validate({ params: z.object({ key: SettingKeyParam }), body: AdminPatchSettingBody }),
    async (req, res) => {
      const params = res.locals.validated!.params as { key: SettingKeyParam };
      const body = res.locals.validated!.body as AdminPatchSettingBody;
      const data = await directory.putSetting(db, res.locals.auth!.id, params.key, body.value);
      await admin.audit(db, {
        actorId: res.locals.auth!.id,
        action: 'settings.put',
        targetType: 'platform_setting',
        targetId: params.key.slice(0, 36),
        reason: body.reason,
        after: { value: body.value },
        ipAddress: req.ip,
      });
      res.json({ data });
    },
  );

  router.get('/audit-logs', ...superAdmin, async (req, res) => {
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    const actorId = typeof req.query.actorId === 'string' ? req.query.actorId : undefined;
    const targetType = typeof req.query.targetType === 'string' ? req.query.targetType : undefined;
    res.json({ data: await directory.listAuditLogs(db, { action, actorId, targetType }) });
  });

  return router;
}

function paymentsStatus(raw: string) {
  return (
    ['UNPAID', 'PAYMENT_REPORTED', 'PAID', 'WAIVED', 'REFUNDED', 'PAYMENT_DISPUTED'] as const
  ).find((value) => value === raw);
}
