import { money, shareForSlot } from '@playaround/contracts';
import { AppError } from '../../lib/errors';
import { notify } from '../../lib/notify';
import {
  emitParticipantJoined,
  emitParticipantLeft,
  emitSessionAvailability,
  emitSessionStatus,
  emitToUser,
} from '../../lib/realtime';
import { applyShareChange } from '../payments/payment.service';
import { sessionInclude, toSummary } from './session.mapper';
import type { SessionCtx } from './session.service';

const ACTIVE = ['CONFIRMED', 'ATTENDED'] as const;

function nextSlot(used: Array<number | null>, capacity: number): number {
  const taken = new Set(used.filter((slot): slot is number => slot != null));
  for (let slot = 0; slot < capacity; slot += 1) {
    if (!taken.has(slot)) return slot;
  }
  throw new AppError('SESSION_FULL', 'No spots left.');
}

export async function joinSession(ctx: SessionCtx, sessionId: string, userId: string, expectedVersion?: number) {
  const now = ctx.now();
  const result = await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: { participants: true, sport: true, venue: true, organiser: { include: { profile: true } } },
    });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    if (expectedVersion != null && expectedVersion !== session.version) {
      throw new AppError('VERSION_CONFLICT', 'The session has changed. Refresh and try again.');
    }
    if (now >= session.startsAt) throw new AppError('SESSION_STARTED', 'The session has already started.');
    if ((session.status !== 'OPEN' && session.status !== 'FULL') || session.venueConfirmationStatus !== 'CONFIRMED') {
      throw new AppError('SESSION_NOT_JOINABLE', 'This session is not joinable yet.');
    }
    if (session.status !== 'OPEN' || session.confirmedCount >= session.capacity) {
      throw new AppError('SESSION_FULL', 'No spots left.');
    }
    if (session.organiserId === userId) {
      throw new AppError('INVALID_STATE_TRANSITION', 'Organisers join via organiser participation.');
    }

    const existing = session.participants.find((p) => p.userId === userId);
    if (existing?.cancellationReason === 'REMOVED_BY_ORGANISER') {
      throw new AppError('REMOVED_BY_ORGANISER', 'The organiser removed you from this session.');
    }
    if (existing && ACTIVE.includes(existing.status as (typeof ACTIVE)[number])) {
      throw new AppError('ALREADY_JOINED', 'You have already joined.');
    }
    if (session.confirmedCount >= session.capacity) throw new AppError('SESSION_FULL', 'No spots left.');

    const slot = nextSlot(
      session.participants.map((p) => p.shareSlot),
      session.capacity,
    );
    const participant = existing
      ? await tx.sessionParticipant.update({
          where: { id: existing.id },
          data: {
            status: 'CONFIRMED',
            role: 'PLAYER',
            shareSlot: slot,
            cancellationReason: null,
            cancelledAt: null,
            joinedAt: now,
          },
        })
      : await tx.sessionParticipant.create({
          data: { sessionId, userId, role: 'PLAYER', status: 'CONFIRMED', shareSlot: slot },
        });

    const count = session.confirmedCount + 1;
    const updated = await tx.session.update({
      where: { id: sessionId },
      data: {
        confirmedCount: count,
        status: count >= session.capacity ? 'FULL' : 'OPEN',
        version: { increment: 1 },
      },
      include: sessionInclude,
    });

    const total = session.totalCostFils ?? 0;
    let payment = null;
    if (total > 0) {
      const amount = shareForSlot(total, session.capacity, slot);
      const prior = existing
        ? await tx.payment.findUnique({ where: { participantId: participant.id } })
        : null;
      const resetUnpaid = !prior || prior.status === 'UNPAID' || prior.status === 'PAYMENT_REPORTED';
      payment = existing
        ? await tx.payment.upsert({
            where: { participantId: participant.id },
            create: {
              sessionId,
              participantId: participant.id,
              payerId: userId,
              payeeId: session.organiserId,
              amountDueFils: amount,
              agreedAmountFils: amount,
            },
            update: {
              amountDueFils: amount,
              agreedAmountFils: amount,
              ...(resetUnpaid ? { status: 'UNPAID' as const } : {}),
            },
          })
        : await tx.payment.create({
            data: {
              sessionId,
              participantId: participant.id,
              payerId: userId,
              payeeId: session.organiserId,
              amountDueFils: amount,
              agreedAmountFils: amount,
            },
          });
    }

    await tx.sessionInterest.deleteMany({ where: { sessionId, userId } });
    await tx.sessionEvent.create({
      data: { sessionId, actorId: userId, type: 'PLAYER_JOINED', data: { userId } },
    });
    await notify(tx, {
      userId: session.organiserId,
      type: 'PLAYER_JOINED',
      title: 'Someone joined',
      body: 'A player joined your session.',
      sessionId,
      actorId: userId,
    });
    if (updated.status === 'FULL') {
      await notify(tx, {
        userId: session.organiserId,
        type: 'SESSION_FULL',
        title: 'Session is full',
        body: 'Your session reached capacity.',
        sessionId,
      });
    }

    return {
      summary: toSummary(updated, now),
      participant: { id: participant.id, status: participant.status, shareSlot: participant.shareSlot },
      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            amountDue: money(payment.amountDueFils),
            payTo: {
              organiserId: session.organiserId,
              displayName: session.organiser.profile?.displayName ?? 'Organiser',
            },
          }
        : null,
    };
  });
  emitSessionAvailability(result.summary);
  emitSessionStatus(result.summary);
  emitParticipantJoined(result.summary.id, userId, result.summary.version);
  if (result.summary.status === 'FULL') {
    emitSessionStatus(result.summary);
  }
  return result;
}

export async function leaveSession(ctx: SessionCtx, sessionId: string, userId: string, reason: 'LEFT' | 'PRICE_REJECTED' | 'PRICE_NOT_ACCEPTED' = 'LEFT') {
  const now = ctx.now();
  const summary = await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: { participants: true, ...sessionInclude },
    });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    if (now >= session.startsAt) throw new AppError('SESSION_STARTED', 'Leaving is closed once the session starts.');
    const existing = session.participants.find((p) => p.userId === userId);
    if (!existing || !ACTIVE.includes(existing.status as (typeof ACTIVE)[number])) {
      throw new AppError('NOT_A_PARTICIPANT', 'You are not in this session.');
    }
    if (existing.role === 'ORGANISER') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Organisers leave via organiser participation.');
    }
    await tx.sessionParticipant.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', shareSlot: null, cancellationReason: reason, cancelledAt: now },
    });
    const count = Math.max(0, session.confirmedCount - 1);
    const wasFull = session.status === 'FULL';
    const updated = await tx.session.update({
      where: { id: sessionId },
      data: { confirmedCount: count, status: 'OPEN', version: { increment: 1 } },
      include: sessionInclude,
    });
    await notify(tx, {
      userId: session.organiserId,
      type: 'PLAYER_LEFT',
      title: 'Someone left',
      body: 'A player left your session.',
      sessionId,
      actorId: userId,
    });
    if (wasFull) {
      await notify(tx, {
        userId: session.organiserId,
        type: 'SESSION_REOPENED',
        title: 'A spot opened',
        body: 'Your session has a free spot again.',
        sessionId,
      });
    }
    return toSummary(updated, now);
  });
  emitSessionAvailability(summary);
  emitSessionStatus(summary);
  emitParticipantLeft(summary.id, userId, summary.version);
  emitToUser(userId, 'participant:updated', { sessionId, status: 'CANCELLED', cancellationReason: reason });
  return summary;
}

export async function removeParticipant(ctx: SessionCtx, sessionId: string, organiserId: string, targetUserId: string) {
  const now = ctx.now();
  return ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({ where: { id: sessionId }, include: { participants: true } });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    if (session.organiserId !== organiserId) throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
    const existing = session.participants.find((p) => p.userId === targetUserId);
    if (!existing || !ACTIVE.includes(existing.status as (typeof ACTIVE)[number])) {
      throw new AppError('NOT_A_PARTICIPANT', 'That player is not in this session.');
    }
    if (existing.role === 'ORGANISER') {
      throw new AppError('INVALID_STATE_TRANSITION', 'Use organiser participation to step out.');
    }
    await tx.sessionParticipant.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        shareSlot: null,
        cancellationReason: 'REMOVED_BY_ORGANISER',
        cancelledAt: now,
      },
    });
    const count = Math.max(0, session.confirmedCount - 1);
    await tx.session.update({
      where: { id: sessionId },
      data: { confirmedCount: count, status: 'OPEN', version: { increment: 1 } },
    });
    await notify(tx, {
      userId: targetUserId,
      type: 'PLAYER_REMOVED',
      title: 'Removed from a session',
      body: 'The organiser removed you from a session.',
      sessionId,
      actorId: organiserId,
    });
  });
}

export async function toggleInterest(ctx: SessionCtx, sessionId: string, userId: string, interested: boolean) {
  const session = await ctx.db.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
  if (session.sessionType !== 'LOOKING_FOR_PLAYERS' || session.venueConfirmationStatus !== 'PENDING') {
    throw new AppError('SESSION_NOT_JOINABLE', 'Interest is only for pending venue sessions.');
  }
  if (interested) {
    await ctx.db.sessionInterest.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId },
      update: {},
    });
  } else {
    await ctx.db.sessionInterest.deleteMany({ where: { sessionId, userId } });
  }
  const count = await ctx.db.sessionInterest.count({ where: { sessionId } });
  await ctx.db.session.update({ where: { id: sessionId }, data: { interestedCount: count, version: { increment: 1 } } });
}

export async function listParticipants(ctx: SessionCtx, sessionId: string, viewerId: string) {
  const session = await ctx.db.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: {
        where: { status: { in: ['CONFIRMED', 'ATTENDED', 'NO_SHOW'] } },
        include: { user: { include: { profile: true } }, payment: true },
      },
    },
  });
  if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
  const isOrganiser = session.organiserId === viewerId;
  return session.participants.map((p) => ({
    userId: p.userId,
    role: p.role,
    status: p.status,
    shareSlot: p.shareSlot,
    displayName: p.user.profile?.displayName ?? 'Player',
    avatarUrl: p.user.profile?.avatarUrl ?? null,
    paymentStatus: isOrganiser ? (p.payment?.status ?? null) : p.userId === viewerId ? (p.payment?.status ?? null) : null,
  }));
}

export async function markAttendance(
  ctx: SessionCtx,
  sessionId: string,
  organiserId: string,
  targetUserId: string,
  status: 'ATTENDED' | 'NO_SHOW',
) {
  const now = ctx.now();
  const session = await ctx.db.session.findUnique({ where: { id: sessionId } });
  if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
  if (session.organiserId !== organiserId) throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
  const windowEnd = new Date(
    session.endsAt.getTime() + 72 * 60 * 60 * 1000,
  );
  if (now < session.startsAt || now > windowEnd) {
    throw new AppError('DEADLINE_PASSED', 'Attendance can be marked from start until 72 hours after end.');
  }
  const participant = await ctx.db.sessionParticipant.findUnique({
    where: { sessionId_userId: { sessionId, userId: targetUserId } },
  });
  if (!participant || !['CONFIRMED', 'ATTENDED', 'NO_SHOW'].includes(participant.status)) {
    throw new AppError('NOT_A_PARTICIPANT', 'That player is not in this session.');
  }
  await ctx.db.sessionParticipant.update({
    where: { id: participant.id },
    data: { status, attendanceMarkedAt: now, attendanceMarkedById: organiserId },
  });
}

export async function respondPriceConsent(ctx: SessionCtx, consentId: string, userId: string, accept: boolean) {
  const consent = await ctx.db.priceConsent.findUnique({
    where: { id: consentId },
    include: { participant: true, priceChange: true },
  });
  if (!consent || consent.participant.userId !== userId) throw new AppError('NOT_FOUND', 'Consent not found.');
  if (consent.status !== 'PENDING') throw new AppError('INVALID_STATE_TRANSITION', 'This consent is no longer pending.');
  const now = ctx.now();
  if (accept) {
    await ctx.db.$transaction(async (tx) => {
      await tx.priceConsent.update({
        where: { id: consentId },
        data: { status: 'ACCEPTED', respondedAt: now },
      });
      const payment = await tx.payment.findUnique({ where: { participantId: consent.participantId } });
      if (payment) {
        await applyShareChange(tx, payment.id, consent.newAmountFils, consent.priceChange.createdById);
      }
    });
    return;
  }
  await ctx.db.priceConsent.update({
    where: { id: consentId },
    data: { status: 'REJECTED', respondedAt: now },
  });
  await leaveSession(ctx, consent.priceChange.sessionId, userId, 'PRICE_REJECTED');
}
