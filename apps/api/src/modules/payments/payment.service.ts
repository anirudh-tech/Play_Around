import {
  assertPaymentReference,
  money,
  type ConfirmPaymentBody,
  type OpenDisputeBody,
  type PaymentAction,
  type PaymentActorRole,
  type PaymentMethod,
  type PaymentStatus,
  type RefundPaymentBody,
  type ReportPaymentBody,
} from '@playaround/contracts';
import type { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';
import { emitAdminFeed } from '../../lib/realtime';
import { notify } from '../../lib/notify';
import type { Database } from '../../lib/prisma';

export interface PaymentCtx {
  db: Database;
  now: () => Date;
}

type Tx = Prisma.TransactionClient;

const paymentInclude = {
  session: { select: { id: true, title: true, startsAt: true } },
  payer: { include: { profile: true } },
  payee: { include: { profile: true } },
  participant: true,
  confirmations: { orderBy: { createdAt: 'asc' as const } },
  disputes: { where: { status: 'OPEN' as const } },
};

function toDto(row: {
  id: string;
  status: PaymentStatus;
  amountDueFils: number;
  agreedAmountFils: number;
  amountPaidFils: number;
  refundedAmountFils: number;
  lastMethod: PaymentMethod | null;
  lastReference: string | null;
  version: number;
  session: { id: string; title: string | null; startsAt: Date };
  payer: { id: string; profile: { displayName: string } | null };
  payee: { id: string; profile: { displayName: string } | null };
  participant: { status: string };
  confirmations: Array<{
    action: string;
    actorRole: string;
    toStatus: string;
    method: PaymentMethod | null;
    createdAt: Date;
    amountFils: number | null;
    note: string | null;
    reference: string | null;
  }>;
  disputes: Array<{
    id: string;
    reason: string;
    description: string | null;
    status: string;
    openedById: string;
  }>;
}) {
  return {
    id: row.id,
    status: row.status,
    amountDue: money(row.amountDueFils),
    agreedAmount: money(row.agreedAmountFils),
    amountPaid: money(row.amountPaidFils),
    refundedAmount: money(row.refundedAmountFils),
    lastMethod: row.lastMethod,
    lastReference: row.lastReference,
    participantStatus: row.participant.status,
    session: {
      id: row.session.id,
      title: row.session.title ?? 'Session',
      startsAt: row.session.startsAt.toISOString(),
    },
    payer: { id: row.payer.id, displayName: row.payer.profile?.displayName ?? 'Player' },
    payee: { id: row.payee.id, displayName: row.payee.profile?.displayName ?? 'Organiser' },
    openDispute: row.disputes[0]
      ? {
          id: row.disputes[0].id,
          reason: row.disputes[0].reason,
          description: row.disputes[0].description,
          openedById: row.disputes[0].openedById,
        }
      : null,
    log: row.confirmations.map((entry) => ({
      action: entry.action,
      actorRole: entry.actorRole,
      toStatus: entry.toStatus,
      method: entry.method,
      amountFils: entry.amountFils,
      note: entry.note,
      reference: entry.reference,
      createdAt: entry.createdAt.toISOString(),
    })),
    version: row.version,
  };
}

async function loadDto(db: Database | Tx, id: string) {
  const row = await db.payment.findUnique({ where: { id }, include: paymentInclude });
  if (!row) throw new AppError('NOT_FOUND', 'Payment not found.');
  return toDto(row);
}

function assertVisible(row: { payerId: string; payeeId: string }, userId: string, staff: boolean) {
  if (staff) return;
  if (row.payerId !== userId && row.payeeId !== userId) {
    throw new AppError('FORBIDDEN', 'You cannot view this payment.');
  }
}

async function withLockedPayment<T>(
  ctx: PaymentCtx,
  paymentId: string,
  expectedVersion: number | undefined,
  fn: (
    tx: Tx,
    payment: {
      id: string;
      sessionId: string;
      payerId: string;
      payeeId: string;
      status: PaymentStatus;
      amountDueFils: number;
      amountPaidFils: number;
      refundedAmountFils: number;
      version: number;
      lastMethod: PaymentMethod | null;
    },
  ) => Promise<T>,
): Promise<T> {
  return ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${paymentId} FOR UPDATE`;
    const payment = await tx.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new AppError('NOT_FOUND', 'Payment not found.');
    if (expectedVersion != null && expectedVersion !== payment.version) {
      throw new AppError('VERSION_CONFLICT', 'The payment has changed. Refresh and try again.');
    }
    return fn(tx, payment);
  });
}

async function logAction(
  tx: Tx,
  input: {
    paymentId: string;
    actorId: string | null;
    actorRole: PaymentActorRole;
    action: PaymentAction;
    fromStatus: PaymentStatus;
    toStatus: PaymentStatus;
    amountFils?: number;
    method?: PaymentMethod;
    reference?: string;
    note?: string;
  },
) {
  await tx.paymentConfirmation.create({
    data: {
      paymentId: input.paymentId,
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      amountFils: input.amountFils,
      method: input.method,
      reference: input.reference,
      note: input.note,
    },
  });
}

export async function applyShareChange(
  tx: Tx,
  paymentId: string,
  newAmountFils: number,
  actorId?: string,
) {
  const payment = await tx.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  const fromStatus = payment.status;
  let toStatus = payment.status;
  if (payment.status === 'PAID' && newAmountFils > payment.amountPaidFils) {
    toStatus = 'UNPAID';
  }
  await tx.payment.update({
    where: { id: paymentId },
    data: {
      amountDueFils: newAmountFils,
      agreedAmountFils: newAmountFils,
      status: toStatus,
      version: { increment: 1 },
    },
  });
  await logAction(tx, {
    paymentId,
    actorId: actorId ?? null,
    actorRole: actorId ? 'ORGANISER' : 'SYSTEM',
    action: 'AMOUNT_CHANGED',
    fromStatus,
    toStatus,
    amountFils: newAmountFils,
  });
}

export async function listMine(ctx: PaymentCtx, userId: string, role: 'payer' | 'payee', status?: PaymentStatus) {
  const rows = await ctx.db.payment.findMany({
    where: {
      ...(role === 'payer' ? { payerId: userId } : { payeeId: userId }),
      ...(status ? { status } : {}),
    },
    include: paymentInclude,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return rows.map(toDto);
}

export async function sessionOverview(ctx: PaymentCtx, sessionId: string, organiserId: string) {
  const session = await ctx.db.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
  if (session.organiserId !== organiserId) throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
  const rows = await ctx.db.payment.findMany({
    where: { sessionId },
    include: paymentInclude,
    orderBy: { createdAt: 'asc' },
  });
  const totals = rows.reduce(
    (acc, row) => {
      acc.due += row.amountDueFils;
      acc.paid += row.amountPaidFils;
      acc.refunded += row.refundedAmountFils;
      return acc;
    },
    { due: 0, paid: 0, refunded: 0 },
  );
  return {
    payments: rows.map(toDto),
    totals: {
      due: money(totals.due),
      paid: money(totals.paid),
      refunded: money(totals.refunded),
    },
  };
}

export async function getPayment(ctx: PaymentCtx, paymentId: string, userId: string, staff: boolean) {
  const row = await ctx.db.payment.findUnique({ where: { id: paymentId }, include: paymentInclude });
  if (!row) throw new AppError('NOT_FOUND', 'Payment not found.');
  assertVisible(row, userId, staff);
  return toDto(row);
}

export async function reportPayment(ctx: PaymentCtx, paymentId: string, userId: string, body: ReportPaymentBody) {
  try {
    assertPaymentReference(body.reference);
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Do not enter card numbers as a payment reference.');
  }
  await withLockedPayment(ctx, paymentId, body.expectedVersion, async (tx, payment) => {
    if (payment.payerId !== userId) throw new AppError('FORBIDDEN', 'Only the payer can report payment.');
    if (payment.status !== 'UNPAID') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Only unpaid shares can be reported.');
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'PAYMENT_REPORTED',
        lastMethod: body.method,
        lastReference: body.reference,
        reportedAt: ctx.now(),
        version: { increment: 1 },
      },
    });
    await logAction(tx, {
      paymentId: payment.id,
      actorId: userId,
      actorRole: 'PLAYER',
      action: 'REPORTED_BY_PLAYER',
      fromStatus: 'UNPAID',
      toStatus: 'PAYMENT_REPORTED',
      method: body.method,
      reference: body.reference,
      note: body.note,
    });
    await notify(tx, {
      userId: payment.payeeId,
      type: 'PAYMENT_REPORTED',
      title: 'Payment reported',
      body: 'A player reported paying you.',
      sessionId: payment.sessionId,
      actorId: userId,
      entityType: 'payment',
      entityId: payment.id,
    });
  });
  return loadDto(ctx.db, paymentId);
}

export async function retractReport(ctx: PaymentCtx, paymentId: string, userId: string, expectedVersion?: number) {
  await withLockedPayment(ctx, paymentId, expectedVersion, async (tx, payment) => {
    if (payment.payerId !== userId) throw new AppError('FORBIDDEN', 'Only the payer can retract a report.');
    if (payment.status !== 'PAYMENT_REPORTED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'There is no report to retract.');
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'UNPAID', reportedAt: null, version: { increment: 1 } },
    });
    await logAction(tx, {
      paymentId: payment.id,
      actorId: userId,
      actorRole: 'PLAYER',
      action: 'REPORT_RETRACTED',
      fromStatus: 'PAYMENT_REPORTED',
      toStatus: 'UNPAID',
    });
  });
  return loadDto(ctx.db, paymentId);
}

async function closeOpenDispute(
  tx: Tx,
  paymentId: string,
  resolverId: string,
  resolutionStatus: PaymentStatus,
  note: string,
) {
  const open = await tx.paymentDispute.findFirst({ where: { paymentId, status: 'OPEN' } });
  if (!open) return;
  await tx.paymentDispute.update({
    where: { id: open.id },
    data: {
      status: 'RESOLVED',
      resolutionStatus,
      resolutionNote: note,
      resolvedById: resolverId,
      resolvedAt: new Date(),
      openLock: null,
    },
  });
}

export async function confirmPayment(
  ctx: PaymentCtx,
  paymentId: string,
  userId: string,
  body: ConfirmPaymentBody,
  asAdmin = false,
) {
  await withLockedPayment(ctx, paymentId, body.expectedVersion, async (tx, payment) => {
    if (!asAdmin && payment.payeeId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the organiser can confirm receipt.');
    }
    if (!['UNPAID', 'PAYMENT_REPORTED', 'PAYMENT_DISPUTED'].includes(payment.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'This payment cannot be confirmed.');
    }
    const outstanding = Math.max(0, payment.amountDueFils - payment.amountPaidFils);
    const add = body.amountFils ?? outstanding;
    if (add <= 0) throw new AppError('INVALID_STATE_TRANSITION', 'Nothing outstanding to confirm.');
    const newPaid = payment.amountPaidFils + add;
    const toStatus: PaymentStatus = newPaid >= payment.amountDueFils ? 'PAID' : payment.status === 'PAYMENT_REPORTED' ? 'PAYMENT_REPORTED' : 'UNPAID';
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        amountPaidFils: newPaid,
        status: toStatus,
        lastMethod: body.method ?? payment.lastMethod,
        paidAt: toStatus === 'PAID' ? ctx.now() : undefined,
        version: { increment: 1 },
      },
    });
    await logAction(tx, {
      paymentId: payment.id,
      actorId: userId,
      actorRole: asAdmin ? 'ADMIN' : 'ORGANISER',
      action: asAdmin ? 'CONFIRMED_BY_ADMIN' : 'CONFIRMED_BY_ORGANISER',
      fromStatus: payment.status,
      toStatus,
      amountFils: add,
      method: body.method,
      note: body.note,
    });
    if (payment.status === 'PAYMENT_DISPUTED') {
      await closeOpenDispute(tx, payment.id, userId, toStatus, body.note ?? 'Confirmed during dispute.');
      await logAction(tx, {
        paymentId: payment.id,
        actorId: userId,
        actorRole: asAdmin ? 'ADMIN' : 'ORGANISER',
        action: 'DISPUTE_RESOLVED',
        fromStatus: 'PAYMENT_DISPUTED',
        toStatus,
        note: body.note,
      });
    }
    await notify(tx, {
      userId: payment.payerId,
      type: 'PAYMENT_CONFIRMED',
      title: 'Payment confirmed',
      body: 'The organiser confirmed your payment.',
      sessionId: payment.sessionId,
      actorId: userId,
      entityType: 'payment',
      entityId: payment.id,
    });
  });
  return loadDto(ctx.db, paymentId);
}

export async function waivePayment(
  ctx: PaymentCtx,
  paymentId: string,
  userId: string,
  note: string | undefined,
  expectedVersion: number | undefined,
  asAdmin = false,
) {
  await withLockedPayment(ctx, paymentId, expectedVersion, async (tx, payment) => {
    if (!asAdmin && payment.payeeId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the organiser can waive a payment.');
    }
    if (!['UNPAID', 'PAYMENT_REPORTED', 'PAYMENT_DISPUTED'].includes(payment.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'This payment cannot be waived.');
    }
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'WAIVED', waivedAt: ctx.now(), version: { increment: 1 } },
    });
    await logAction(tx, {
      paymentId: payment.id,
      actorId: userId,
      actorRole: asAdmin ? 'ADMIN' : 'ORGANISER',
      action: 'WAIVED',
      fromStatus: payment.status,
      toStatus: 'WAIVED',
      note,
    });
    if (payment.status === 'PAYMENT_DISPUTED') {
      await closeOpenDispute(tx, payment.id, userId, 'WAIVED', note ?? 'Waived during dispute.');
      await logAction(tx, {
        paymentId: payment.id,
        actorId: userId,
        actorRole: asAdmin ? 'ADMIN' : 'ORGANISER',
        action: 'DISPUTE_RESOLVED',
        fromStatus: 'PAYMENT_DISPUTED',
        toStatus: 'WAIVED',
        note,
      });
    }
    await notify(tx, {
      userId: payment.payerId,
      type: 'PAYMENT_WAIVED',
      title: 'Share waived',
      body: 'The organiser waived your share.',
      sessionId: payment.sessionId,
      actorId: userId,
      entityType: 'payment',
      entityId: payment.id,
    });
  });
  return loadDto(ctx.db, paymentId);
}

export async function refundPayment(
  ctx: PaymentCtx,
  paymentId: string,
  userId: string,
  body: RefundPaymentBody,
  asAdmin = false,
) {
  await withLockedPayment(ctx, paymentId, body.expectedVersion, async (tx, payment) => {
    if (!asAdmin && payment.payeeId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the organiser can record a refund.');
    }
    if (!['PAID', 'PAYMENT_DISPUTED', 'REFUNDED'].includes(payment.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Refunds can only be recorded against paid shares.');
    }
    const remaining = payment.amountPaidFils - payment.refundedAmountFils;
    if (body.amountFils > remaining) {
      throw new AppError('REFUND_EXCEEDS_PAID', 'Refund cannot exceed the amount paid.');
    }
    const refunded = payment.refundedAmountFils + body.amountFils;
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmountFils: refunded,
        status: 'REFUNDED',
        refundedAt: ctx.now(),
        version: { increment: 1 },
      },
    });
    await logAction(tx, {
      paymentId: payment.id,
      actorId: userId,
      actorRole: asAdmin ? 'ADMIN' : 'ORGANISER',
      action: 'REFUND_RECORDED',
      fromStatus: payment.status,
      toStatus: 'REFUNDED',
      amountFils: body.amountFils,
      method: body.method,
      note: body.note,
    });
    if (payment.status === 'PAYMENT_DISPUTED') {
      await closeOpenDispute(tx, payment.id, userId, 'REFUNDED', body.note ?? 'Refund recorded.');
    }
    await notify(tx, {
      userId: payment.payerId,
      type: 'REFUND_RECORDED',
      title: 'Refund recorded',
      body: 'The organiser recorded an offline refund.',
      sessionId: payment.sessionId,
      actorId: userId,
      entityType: 'payment',
      entityId: payment.id,
    });
  });
  return loadDto(ctx.db, paymentId);
}

async function openDisputeInner(
  tx: Tx,
  payment: { id: string; sessionId: string; payerId: string; payeeId: string; status: PaymentStatus },
  userId: string,
  body: OpenDisputeBody,
  actorRole: PaymentActorRole,
) {
  const existing = await tx.paymentDispute.findFirst({ where: { paymentId: payment.id, status: 'OPEN' } });
  if (existing) throw new AppError('DISPUTE_ALREADY_OPEN', 'A dispute is already open.');
  if (payment.status === 'PAYMENT_DISPUTED') {
    throw new AppError('DISPUTE_ALREADY_OPEN', 'A dispute is already open.');
  }
  await tx.paymentDispute.create({
    data: {
      paymentId: payment.id,
      openedById: userId,
      reason: body.reason,
      description: body.description,
      statusBeforeDispute: payment.status,
      openLock: payment.id,
    },
  });
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: 'PAYMENT_DISPUTED', version: { increment: 1 } },
  });
  await logAction(tx, {
    paymentId: payment.id,
    actorId: userId,
    actorRole,
    action: 'DISPUTE_OPENED',
    fromStatus: payment.status,
    toStatus: 'PAYMENT_DISPUTED',
    note: body.description,
  });
  const other = userId === payment.payerId ? payment.payeeId : payment.payerId;
  await notify(tx, {
    userId: other,
    type: 'PAYMENT_DISPUTED',
    title: 'Payment disputed',
    body: 'A payment dispute was opened.',
    sessionId: payment.sessionId,
    actorId: userId,
    entityType: 'payment',
    entityId: payment.id,
  });
  emitAdminFeed({
    kind: 'payment_dispute',
    refId: payment.id,
    summary: 'A payment dispute was opened.',
  });
}

export async function rejectReport(ctx: PaymentCtx, paymentId: string, userId: string, body: OpenDisputeBody) {
  await withLockedPayment(ctx, paymentId, body.expectedVersion, async (tx, payment) => {
    if (payment.payeeId !== userId) throw new AppError('FORBIDDEN', 'Only the organiser can reject a report.');
    if (payment.status !== 'PAYMENT_REPORTED') {
      throw new AppError('INVALID_STATE_TRANSITION', 'There is no report to reject.');
    }
    await logAction(tx, {
      paymentId: payment.id,
      actorId: userId,
      actorRole: 'ORGANISER',
      action: 'REPORT_REJECTED',
      fromStatus: 'PAYMENT_REPORTED',
      toStatus: 'PAYMENT_DISPUTED',
      note: body.description,
    });
    await openDisputeInner(tx, payment, userId, body, 'ORGANISER');
  });
  return loadDto(ctx.db, paymentId);
}

export async function openDispute(ctx: PaymentCtx, paymentId: string, userId: string, body: OpenDisputeBody) {
  await withLockedPayment(ctx, paymentId, body.expectedVersion, async (tx, payment) => {
    if (payment.payerId !== userId && payment.payeeId !== userId) {
      throw new AppError('FORBIDDEN', 'Only the payer or organiser can open a dispute.');
    }
    if (payment.status === 'PAYMENT_DISPUTED') {
      throw new AppError('DISPUTE_ALREADY_OPEN', 'A dispute is already open.');
    }
    if (!['UNPAID', 'PAYMENT_REPORTED', 'PAID', 'REFUNDED', 'WAIVED'].includes(payment.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'A dispute cannot be opened in this state.');
    }
    const role: PaymentActorRole = payment.payerId === userId ? 'PLAYER' : 'ORGANISER';
    await openDisputeInner(tx, payment, userId, body, role);
  });
  return loadDto(ctx.db, paymentId);
}

export async function withdrawDispute(ctx: PaymentCtx, disputeId: string, userId: string) {
  const dispute = await ctx.db.paymentDispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new AppError('NOT_FOUND', 'Dispute not found.');
  if (dispute.openedById !== userId) throw new AppError('FORBIDDEN', 'Only the opener can withdraw this dispute.');
  if (dispute.status !== 'OPEN') throw new AppError('INVALID_STATE_TRANSITION', 'This dispute is already closed.');
  await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${dispute.paymentId} FOR UPDATE`;
    await tx.paymentDispute.update({
      where: { id: disputeId },
      data: { status: 'WITHDRAWN', openLock: null, resolvedAt: ctx.now(), resolvedById: userId },
    });
    await tx.payment.update({
      where: { id: dispute.paymentId },
      data: { status: dispute.statusBeforeDispute, version: { increment: 1 } },
    });
    const payment = await tx.payment.findUnique({ where: { id: dispute.paymentId } });
    await logAction(tx, {
      paymentId: dispute.paymentId,
      actorId: userId,
      actorRole: payment?.payerId === userId ? 'PLAYER' : 'ORGANISER',
      action: 'DISPUTE_WITHDRAWN',
      fromStatus: 'PAYMENT_DISPUTED',
      toStatus: dispute.statusBeforeDispute,
    });
  });
  return loadDto(ctx.db, dispute.paymentId);
}

export async function correctStatus(
  ctx: PaymentCtx,
  paymentId: string,
  userId: string,
  status: PaymentStatus,
  note: string | undefined,
  expectedVersion?: number,
) {
  await withLockedPayment(ctx, paymentId, expectedVersion, async (tx, payment) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status, version: { increment: 1 } },
    });
    await logAction(tx, {
      paymentId: payment.id,
      actorId: userId,
      actorRole: 'ADMIN',
      action: 'STATUS_CORRECTED',
      fromStatus: payment.status,
      toStatus: status,
      note,
    });
    if (payment.status === 'PAYMENT_DISPUTED' && status !== 'PAYMENT_DISPUTED') {
      await closeOpenDispute(tx, payment.id, userId, status, note ?? 'Corrected by staff.');
    }
  });
  return loadDto(ctx.db, paymentId);
}

export async function resolveDispute(
  ctx: PaymentCtx,
  disputeId: string,
  staffId: string,
  resolutionStatus: PaymentStatus,
  note: string,
) {
  const dispute = await ctx.db.paymentDispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new AppError('NOT_FOUND', 'Dispute not found.');
  if (dispute.status !== 'OPEN') throw new AppError('INVALID_STATE_TRANSITION', 'This dispute is already closed.');
  await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM payments WHERE id = ${dispute.paymentId} FOR UPDATE`;
    await tx.paymentDispute.update({
      where: { id: disputeId },
      data: {
        status: 'RESOLVED',
        resolutionStatus,
        resolutionNote: note,
        resolvedById: staffId,
        resolvedAt: ctx.now(),
        openLock: null,
      },
    });
    await tx.payment.update({
      where: { id: dispute.paymentId },
      data: { status: resolutionStatus, version: { increment: 1 } },
    });
    await logAction(tx, {
      paymentId: dispute.paymentId,
      actorId: staffId,
      actorRole: 'ADMIN',
      action: 'DISPUTE_RESOLVED',
      fromStatus: 'PAYMENT_DISPUTED',
      toStatus: resolutionStatus,
      note,
    });
    const payment = await tx.payment.findUnique({ where: { id: dispute.paymentId } });
    if (payment) {
      await notify(tx, {
        userId: payment.payerId,
        type: 'PAYMENT_DISPUTE_RESOLVED',
        title: 'Dispute resolved',
        body: note,
        sessionId: payment.sessionId,
        actorId: staffId,
        entityType: 'payment',
        entityId: payment.id,
      });
    }
  });
  return loadDto(ctx.db, dispute.paymentId);
}

export async function remindUnpaid(ctx: PaymentCtx, sessionId: string, organiserId: string) {
  const session = await ctx.db.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
  if (session.organiserId !== organiserId) throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
  const since = new Date(ctx.now().getTime() - 12 * 60 * 60 * 1000);
  const recent = await ctx.db.notification.findFirst({
    where: { sessionId, type: 'PAYMENT_REMINDER', createdAt: { gte: since } },
  });
  if (recent) throw new AppError('DEADLINE_PASSED', 'A reminder was already sent in the last 12 hours.');
  const unpaid = await ctx.db.payment.findMany({
    where: { sessionId, status: { in: ['UNPAID', 'PAYMENT_REPORTED'] } },
  });
  for (const payment of unpaid) {
    await notify(ctx.db, {
      userId: payment.payerId,
      type: 'PAYMENT_REMINDER',
      title: 'Payment reminder',
      body: 'Please pay the organiser directly for this session.',
      sessionId,
      actorId: organiserId,
      entityType: 'payment',
      entityId: payment.id,
    });
  }
  return { reminded: unpaid.length };
}

export async function listAdminPayments(ctx: PaymentCtx, status?: PaymentStatus) {
  const rows = await ctx.db.payment.findMany({
    where: status ? { status } : {},
    include: paymentInclude,
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });
  return rows.map(toDto);
}

export async function listAdminDisputes(ctx: PaymentCtx, status?: 'OPEN' | 'RESOLVED' | 'WITHDRAWN') {
  return ctx.db.paymentDispute.findMany({
    where: status ? { status } : {},
    include: { payment: { include: paymentInclude } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getAdminDispute(ctx: PaymentCtx, id: string) {
  const row = await ctx.db.paymentDispute.findUnique({
    where: { id },
    include: { payment: { include: paymentInclude } },
  });
  if (!row) throw new AppError('NOT_FOUND', 'Dispute not found.');
  return row;
}
