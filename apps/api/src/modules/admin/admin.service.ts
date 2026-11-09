import type { ProposeVenueOptionBody, VenueArrangementStatus } from '@playaround/contracts';
import { AppError } from '../../lib/errors';
import type { Database } from '../../lib/prisma';
import { proposeVenueOption, recordVenueBooking, type SessionCtx } from '../sessions/session.service';

export async function audit(
  db: Database,
  input: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    reason: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
  },
) {
  await db.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      before: input.before === undefined ? undefined : JSON.parse(JSON.stringify(input.before)),
      after: input.after === undefined ? undefined : JSON.parse(JSON.stringify(input.after)),
      ipAddress: input.ipAddress,
    },
  });
}

const arrangementInclude = {
  session: { select: { id: true, title: true, organiserId: true, startsAt: true, venueConfirmationStatus: true } },
  assignedTo: { include: { profile: true } },
  options: { include: { venue: true } },
};

export async function listArrangements(
  db: Database,
  filters: { status?: VenueArrangementStatus; assignee?: string },
) {
  return db.venueArrangement.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.assignee ? { assignedToId: filters.assignee } : {}),
    },
    include: arrangementInclude,
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
}

export async function getArrangement(db: Database, id: string) {
  const row = await db.venueArrangement.findUnique({
    where: { id },
    include: {
      ...arrangementInclude,
      session: { include: { booking: true } },
    },
  });
  if (!row) throw new AppError('NOT_FOUND', 'Arrangement not found.');
  return row;
}

export async function assignArrangement(db: Database, id: string, assigneeId: string) {
  const assignee = await db.user.findUnique({ where: { id: assigneeId } });
  if (!assignee || !['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'].includes(assignee.role)) {
    throw new AppError('VALIDATION_ERROR', 'Assignee must be a staff member.');
  }
  const current = await db.venueArrangement.findUnique({ where: { id } });
  if (!current) throw new AppError('NOT_FOUND', 'Arrangement not found.');
  return db.venueArrangement.update({
    where: { id },
    data: {
      assignedToId: assigneeId,
      status: current.status === 'REQUESTED' ? 'IN_PROGRESS' : current.status,
    },
    include: arrangementInclude,
  });
}

export async function patchArrangement(
  db: Database,
  id: string,
  input: { status?: 'IN_PROGRESS' | 'UNSUCCESSFUL' | 'CANCELLED'; staffNotes?: string },
) {
  const current = await db.venueArrangement.findUnique({ where: { id } });
  if (!current) throw new AppError('NOT_FOUND', 'Arrangement not found.');
  return db.venueArrangement.update({
    where: { id },
    data: {
      ...(input.status ? { status: input.status, closedReason: input.status === 'UNSUCCESSFUL' ? 'Marked unsuccessful' : current.closedReason } : {}),
      ...(input.staffNotes !== undefined ? { staffNotes: input.staffNotes } : {}),
    },
    include: arrangementInclude,
  });
}

export async function addArrangementOption(
  ctx: SessionCtx,
  arrangementId: string,
  actorId: string,
  input: ProposeVenueOptionBody,
) {
  const arrangement = await ctx.db.venueArrangement.findUnique({ where: { id: arrangementId } });
  if (!arrangement) throw new AppError('NOT_FOUND', 'Arrangement not found.');
  return proposeVenueOption(ctx, arrangement.sessionId, actorId, input);
}

export async function patchVenueOption(
  db: Database,
  optionId: string,
  input: { startsAt?: string; endsAt?: string; totalCostFils?: number; notes?: string },
) {
  const option = await db.venueOption.findUnique({ where: { id: optionId } });
  if (!option) throw new AppError('NOT_FOUND', 'Unknown venue option.');
  if (option.status !== 'PROPOSED') throw new AppError('INVALID_STATE_TRANSITION', 'Only proposed options can be edited.');
  return db.venueOption.update({
    where: { id: optionId },
    data: {
      ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
      ...(input.endsAt ? { endsAt: new Date(input.endsAt) } : {}),
      ...(input.totalCostFils != null ? { totalCostFils: input.totalCostFils } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
  });
}

export async function withdrawVenueOption(db: Database, optionId: string) {
  const option = await db.venueOption.findUnique({ where: { id: optionId } });
  if (!option) throw new AppError('NOT_FOUND', 'Unknown venue option.');
  if (option.status !== 'PROPOSED') throw new AppError('INVALID_STATE_TRANSITION', 'Only proposed options can be withdrawn.');
  return db.venueOption.update({
    where: { id: optionId },
    data: { status: 'WITHDRAWN', decidedAt: new Date() },
  });
}

export async function staffRecordBooking(
  ctx: SessionCtx,
  sessionId: string,
  staffId: string,
  input: {
    venueOptionId: string;
    totalCostFils?: number;
    startsAt?: string;
    endsAt?: string;
    bookingReference?: string;
    venuePaymentStatus?: 'NOT_PAID' | 'PAID';
  },
) {
  return recordVenueBooking(ctx, sessionId, staffId, input, { asStaff: true });
}
