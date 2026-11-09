import {
  PLATFORM_SETTING_DEFAULTS,
  assertCapacity,
  assertDuration,
  assertLeadTime,
  assertPaidShare,
  maxShare,
  minShare,
  priceIncreasePercent,
  splitShares,
  type CreateSessionBody,
  type CreateVenueBody,
  type PatchSessionBody,
} from '@playaround/contracts';
import { AppError } from '../../lib/errors';
import { notify, notifyMany } from '../../lib/notify';
import type { Database } from '../../lib/prisma';
import {
  emitAdminFeed,
  emitSessionAvailability,
  emitSessionStatus,
  emitSessionUpdated,
  emitToUser,
  emitVenueConfirmed,
} from '../../lib/realtime';
import { applyShareChange } from '../payments/payment.service';
import { sessionInclude, toSummary } from './session.mapper';

const SETTINGS = PLATFORM_SETTING_DEFAULTS;

export interface SessionCtx {
  db: Database;
  now: () => Date;
}

function mapRule(error: unknown, sport?: { name: string; minPlayers: number; maxPlayers: number }): never {
  const code = error instanceof Error ? error.message : 'VALIDATION_ERROR';
  if (code === 'LEAD_TIME_TOO_SHORT') throw new AppError('LEAD_TIME_TOO_SHORT', 'Start time must be at least 3 hours away.');
  if (code === 'MIN_PLAYERS_BELOW_SPORT_MIN') {
    throw new AppError('MIN_PLAYERS_BELOW_SPORT_MIN', 'Minimum players is outside the sport limits.');
  }
  if (code === 'SHARE_BELOW_MINIMUM') {
    throw new AppError('SHARE_BELOW_MINIMUM', 'Each player share must be at least AED 10.');
  }
  if (code === 'DURATION_INVALID') {
    throw new AppError('VALIDATION_ERROR', 'Session duration must be between 30 minutes and 6 hours.');
  }
  if (code === 'CAPACITY_OUT_OF_RANGE' && sport) {
    throw new AppError(
      'VALIDATION_ERROR',
      `Capacity for ${sport.name} must be between ${sport.minPlayers} and ${sport.maxPlayers}.`,
    );
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid session details.');
}

async function loadSport(db: Database, sportId: number) {
  const sport = await db.sport.findUnique({ where: { id: sportId } });
  if (!sport?.isActive) throw new AppError('NOT_FOUND', 'Unknown sport.');
  return sport;
}

export async function ensureVenue(ctx: SessionCtx, creatorId: string, input: { venueId: string } | { newVenue: CreateVenueBody }) {
  if ('venueId' in input) {
    const venue = await ctx.db.venue.findUnique({ where: { id: input.venueId } });
    if (!venue || venue.mergedIntoId) throw new AppError('NOT_FOUND', 'Unknown venue.');
    return venue;
  }
  const body = input.newVenue;
  const existing = await ctx.db.venue.findUnique({ where: { googlePlaceId: body.googlePlaceId } });
  if (existing) return existing;
  return ctx.db.venue.create({
    data: {
      googlePlaceId: body.googlePlaceId,
      name: body.name,
      addressLine: body.addressLine,
      area: body.area,
      city: body.city,
      countryCode: body.countryCode ?? 'AE',
      latitude: body.latitude,
      longitude: body.longitude,
      createdById: creatorId,
      sports: { create: body.sportIds.map((sportId) => ({ sportId })) },
    },
  });
}

async function countUpcoming(db: Database, organiserId: string, now: Date) {
  return db.session.count({
    where: {
      organiserId,
      status: { in: ['OPEN', 'FULL'] },
      startsAt: { gt: now },
    },
  });
}

export async function createSession(ctx: SessionCtx, organiserId: string, input: CreateSessionBody) {
  const now = ctx.now();
  const user = await ctx.db.user.findUnique({ where: { id: organiserId } });
  if (!user?.phoneVerifiedAt) {
    throw new AppError('PHONE_NOT_VERIFIED', 'Verify a phone number before publishing a session.');
  }
  if ((await countUpcoming(ctx.db, organiserId, now)) >= SETTINGS['sessions.max_upcoming_organised']) {
    throw new AppError('ORGANISER_LIMIT_REACHED', 'You already have 10 upcoming sessions.');
  }

  const sport = await loadSport(ctx.db, input.sportId);
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  try {
    assertLeadTime(startsAt, now);
    assertDuration(startsAt, endsAt);
    assertCapacity(sport, input.capacity, input.minPlayers ?? null);
  } catch (error) {
    mapRule(error, sport);
  }

  const cost = input.type === 'EXISTING_BOOKING' ? input.totalCostFils : input.estimatedTotalCostFils;
  try {
    assertPaidShare(cost, input.capacity, SETTINGS['payments.min_paid_share_fils']);
  } catch (error) {
    mapRule(error);
  }

  const minDecisionHours = SETTINGS['sessions.min_players_decision_hours_before_start'];
  const venueHours = SETTINGS['sessions.venue_confirm_deadline_hours_before_start'];

  const session = await ctx.db.$transaction(async (tx) => {
    let venueId: string | null = null;
    let latitude: number;
    let longitude: number;
    let locationPrecision: 'EXACT' | 'AREA';
    let preferredAreaLabel: string | null = null;
    let areaRadiusKm: number | null = null;
    let preferredAreaPlaceId: string | null = null;
    let timezone = 'Asia/Dubai';

    if (input.type === 'EXISTING_BOOKING') {
      const venue = await ensureVenue({ db: tx as unknown as Database, now: ctx.now }, organiserId, input.venue);
      venueId = venue.id;
      latitude = Number(venue.latitude);
      longitude = Number(venue.longitude);
      locationPrecision = 'EXACT';
      timezone = venue.timezone;
    } else {
      latitude = input.preferredArea.latitude;
      longitude = input.preferredArea.longitude;
      locationPrecision = 'AREA';
      preferredAreaLabel = input.preferredArea.label;
      areaRadiusKm = input.preferredArea.radiusKm;
      preferredAreaPlaceId = input.preferredArea.googlePlaceId ?? null;
    }

    const created = await tx.session.create({
      data: {
        organiserId,
        sportId: sport.id,
        sessionType: input.type,
        status: 'OPEN',
        venueConfirmationStatus: input.type === 'EXISTING_BOOKING' ? 'CONFIRMED' : 'PENDING',
        venueId,
        preferredAreaLabel,
        preferredAreaPlaceId,
        areaRadiusKm,
        latitude,
        longitude,
        locationPrecision,
        timezone,
        startsAt,
        endsAt,
        venueConfirmDeadline:
          input.type === 'LOOKING_FOR_PLAYERS'
            ? new Date(startsAt.getTime() - venueHours * 60 * 60 * 1000)
            : null,
        venueConfirmedAt: input.type === 'EXISTING_BOOKING' ? now : null,
        capacity: input.capacity,
        minPlayers: input.minPlayers,
        minPlayersDecisionDeadline: input.minPlayers
          ? new Date(startsAt.getTime() - minDecisionHours * 60 * 60 * 1000)
          : null,
        organiserIsPlaying: input.organiserIsPlaying,
        confirmedCount: input.organiserIsPlaying ? 1 : 0,
        estimatedTotalCostFils: input.type === 'LOOKING_FOR_PLAYERS' ? cost : null,
        estimatedShareMaxFils: input.type === 'LOOKING_FOR_PLAYERS' ? maxShare(cost, input.capacity) : null,
        totalCostFils: input.type === 'EXISTING_BOOKING' ? cost : null,
        shareMaxFils: input.type === 'EXISTING_BOOKING' ? maxShare(cost, input.capacity) : null,
        skillLevel: input.skillLevel,
        title: input.title,
        instructions: input.instructions,
      },
      include: sessionInclude,
    });

    if (input.organiserIsPlaying) {
      await tx.sessionParticipant.create({
        data: {
          sessionId: created.id,
          userId: organiserId,
          role: 'ORGANISER',
          status: 'CONFIRMED',
          shareSlot: 0,
        },
      });
    }

    if (input.type === 'EXISTING_BOOKING' && venueId) {
      await tx.venueBooking.create({
        data: {
          sessionId: created.id,
          venueId,
          startsAt,
          endsAt,
          totalCostFils: cost,
          bookingReference: input.bookingReference,
          venuePaymentStatus: input.venuePaymentStatus ?? 'NOT_PAID',
          recordedById: organiserId,
        },
      });
    }

    if (input.type === 'LOOKING_FOR_PLAYERS') {
      await tx.venueArrangement.create({ data: { sessionId: created.id, status: 'REQUESTED' } });
    }

    await tx.sessionEvent.create({
      data: { sessionId: created.id, actorId: organiserId, type: 'CREATED', data: { type: input.type } },
    });
    return created;
  });

  const createdSummary = toSummary(session, now);
  if (input.type === 'LOOKING_FOR_PLAYERS') {
    emitAdminFeed({
      kind: 'venue_arrangement',
      refId: session.id,
      summary: `Venue arrangement requested for ${createdSummary.title ?? 'a session'}`,
    });
  }
  return createdSummary;
}

export async function getSession(ctx: SessionCtx, id: string) {
  const row = await ctx.db.session.findUnique({ where: { id }, include: sessionInclude });
  if (!row) throw new AppError('NOT_FOUND', 'Session not found.');
  return { summary: toSummary(row, ctx.now()), row };
}

export async function requireOrganiser(ctx: SessionCtx, sessionId: string, userId: string) {
  const row = await ctx.db.session.findUnique({ where: { id: sessionId }, include: sessionInclude });
  if (!row) throw new AppError('NOT_FOUND', 'Session not found.');
  if (row.organiserId !== userId) throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
  return row;
}

export async function cancelSession(
  ctx: SessionCtx,
  sessionId: string,
  actorId: string,
  reason: 'ORGANISER_CANCELLED' | 'ADMIN_CANCELLED' | 'VENUE_NOT_CONFIRMED' | 'MINIMUM_NOT_MET_ORGANISER_CANCELLED' | 'MINIMUM_NOT_MET_NO_DECISION',
  note?: string,
) {
  const now = ctx.now();
  const summary = await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({ where: { id: sessionId }, include: sessionInclude });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    if (reason === 'ORGANISER_CANCELLED' && session.organiserId !== actorId) {
      throw new AppError('NOT_ORGANISER', 'Only the organiser can cancel this session.');
    }
    if (!['OPEN', 'FULL'].includes(session.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'This session cannot be cancelled.');
    }
    const participants = await tx.sessionParticipant.findMany({
      where: { sessionId, status: { in: ['CONFIRMED', 'ATTENDED'] } },
    });
    await tx.sessionParticipant.updateMany({
      where: { sessionId, status: { in: ['CONFIRMED', 'ATTENDED'] } },
      data: { status: 'CANCELLED', cancellationReason: 'SESSION_CANCELLED', shareSlot: null, cancelledAt: now },
    });
    const updated = await tx.session.update({
      where: { id: sessionId },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        cancellationReason: reason,
        cancellationNote: note,
        confirmedCount: 0,
        version: { increment: 1 },
      },
      include: sessionInclude,
    });
    await tx.sessionEvent.create({
      data: { sessionId, actorId, type: 'CANCELLED', data: { reason } },
    });
    await notifyMany(
      tx,
      participants.map((p) => p.userId),
      {
        type: 'SESSION_CANCELLED',
        title: 'Session cancelled',
        body: 'A session you were in has been cancelled.',
        sessionId,
        actorId,
      },
    );
    return toSummary(updated, now);
  });
  emitSessionStatus(summary);
  emitSessionAvailability(summary);
  return summary;
}

export async function patchSession(ctx: SessionCtx, sessionId: string, actorId: string, input: PatchSessionBody) {
  const now = ctx.now();
  const summary = await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({ where: { id: sessionId }, include: { sport: true, participants: true } });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    if (session.organiserId !== actorId) throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
    if (!['OPEN', 'FULL'].includes(session.status)) {
      throw new AppError('INVALID_STATE_TRANSITION', 'This session can no longer be edited.');
    }
    if (input.expectedVersion != null && input.expectedVersion !== session.version) {
      throw new AppError('VERSION_CONFLICT', 'The session has changed. Refresh and try again.');
    }

    const startsAt = input.startsAt ? new Date(input.startsAt) : session.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : session.endsAt;
    const capacity = input.capacity ?? session.capacity;
    const minPlayers = input.minPlayers === undefined ? session.minPlayers : input.minPlayers;
    const totalCost = input.totalCostFils ?? session.totalCostFils ?? session.estimatedTotalCostFils ?? 0;

    if (input.startsAt) {
      try {
        assertLeadTime(startsAt, now);
      } catch (error) {
        mapRule(error);
      }
    }
    if (input.startsAt || input.endsAt) {
      try {
        assertDuration(startsAt, endsAt);
      } catch (error) {
        mapRule(error);
      }
    }
    try {
      assertCapacity(session.sport, capacity, minPlayers);
    } catch (error) {
      mapRule(error);
    }
    if (capacity < session.confirmedCount) {
      throw new AppError('CAPACITY_BELOW_CONFIRMED', 'Capacity cannot be below confirmed players.');
    }
    try {
      assertPaidShare(totalCost, capacity, SETTINGS['payments.min_paid_share_fils']);
    } catch (error) {
      mapRule(error);
    }

    const previousTotal = session.totalCostFils ?? session.estimatedTotalCostFils ?? 0;
    const previousCapacity = session.capacity;
    const costChanged = input.totalCostFils != null || input.capacity != null;
    const confirmed = session.venueConfirmationStatus === 'CONFIRMED';

    if (costChanged && confirmed && input.totalCostFils != null) {
      const hoursToStart = (session.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000);
      if (input.totalCostFils > previousTotal && hoursToStart < 2) {
        throw new AppError('DEADLINE_PASSED', 'Price increases are blocked within 2 hours of start.');
      }
    }

    const updated = await tx.session.update({
      where: { id: sessionId },
      data: {
        title: input.title === undefined ? undefined : input.title,
        instructions: input.instructions === undefined ? undefined : input.instructions,
        skillLevel: input.skillLevel === undefined ? undefined : input.skillLevel,
        startsAt,
        endsAt,
        capacity,
        minPlayers,
        totalCostFils: confirmed ? totalCost : session.totalCostFils,
        shareMaxFils: confirmed ? maxShare(totalCost, capacity) : session.shareMaxFils,
        estimatedTotalCostFils: confirmed ? session.estimatedTotalCostFils : totalCost,
        estimatedShareMaxFils: confirmed ? session.estimatedShareMaxFils : maxShare(totalCost, capacity),
        status: session.confirmedCount >= capacity ? 'FULL' : 'OPEN',
        version: { increment: 1 },
      },
      include: sessionInclude,
    });

    await tx.sessionEvent.create({
      data: { sessionId, actorId, type: 'UPDATED', data: { keys: Object.keys(input) } },
    });

    const actives = session.participants.filter((p) => p.status === 'CONFIRMED' || p.status === 'ATTENDED');
    await notifyMany(
      tx,
      actives.map((p) => p.userId),
      { type: 'SESSION_UPDATED', title: 'Session updated', body: 'Session details changed.', sessionId, actorId },
    );

    if (costChanged && confirmed) {
      const shares = splitShares(totalCost, capacity);
      const threshold = SETTINGS['sessions.price_increase_consent_threshold_pct'];
      const deadline = new Date(now.getTime() + SETTINGS['sessions.price_consent_window_hours'] * 60 * 60 * 1000);
      const change = await tx.sessionPriceChange.create({
        data: {
          sessionId,
          createdById: actorId,
          previousTotalFils: previousTotal,
          newTotalFils: totalCost,
          previousCapacity,
          newCapacity: capacity,
          reason: input.reason,
          consentDeadline: deadline,
        },
      });
      await tx.priceConsent.updateMany({
        where: { priceChange: { sessionId }, status: 'PENDING' },
        data: { status: 'SUPERSEDED', respondedAt: now },
      });

      for (const participant of actives) {
        if (participant.role === 'ORGANISER' || participant.shareSlot == null) continue;
        const payment = await tx.payment.findUnique({ where: { participantId: participant.id } });
        if (!payment) continue;
        const newAmount = shares[participant.shareSlot] ?? minShare(totalCost, capacity);
        const pct = priceIncreasePercent(payment.agreedAmountFils, newAmount);
        if (newAmount < payment.agreedAmountFils || pct <= threshold) {
          await applyShareChange(tx, payment.id, newAmount, actorId);
          await notify(tx, {
            userId: participant.userId,
            type: 'PRICE_CHANGED',
            title: 'Share updated',
            body: 'Your session share has changed.',
            sessionId,
            actorId,
          });
        } else {
          await tx.priceConsent.create({
            data: {
              priceChangeId: change.id,
              participantId: participant.id,
              previousAmountFils: payment.agreedAmountFils,
              newAmountFils: newAmount,
            },
          });
          await notify(tx, {
            userId: participant.userId,
            type: 'PRICE_CONSENT_REQUIRED',
            title: 'Price increase needs your OK',
            body: 'The organiser raised the price by more than 20%. Accept or leave.',
            sessionId,
            actorId,
            entityType: 'price_consent',
            entityId: change.id,
          });
        }
      }
    }

    return toSummary(updated, now);
  });
  emitSessionUpdated(summary.id, summary.version, Object.keys(input));
  emitSessionAvailability(summary);
  return summary;
}

export async function setOrganiserPlaying(ctx: SessionCtx, sessionId: string, userId: string, playing: boolean) {
  const now = ctx.now();
  return ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: { participants: true, ...sessionInclude },
    });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    if (session.organiserId !== userId) throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
    if (now >= session.startsAt) throw new AppError('SESSION_STARTED', 'The session has already started.');

    const existing = session.participants.find((p) => p.userId === userId);
    if (playing && session.organiserIsPlaying) return toSummary(session, now);
    if (!playing && !session.organiserIsPlaying) return toSummary(session, now);

    if (playing) {
      if (session.confirmedCount >= session.capacity) throw new AppError('SESSION_FULL', 'No spots left.');
      const used = new Set(session.participants.filter((p) => p.shareSlot != null).map((p) => p.shareSlot));
      let slot = 0;
      while (used.has(slot)) slot += 1;
      if (existing) {
        if (existing.cancellationReason === 'REMOVED_BY_ORGANISER') {
          throw new AppError('REMOVED_BY_ORGANISER', 'You were removed from this session.');
        }
        await tx.sessionParticipant.update({
          where: { id: existing.id },
          data: { status: 'CONFIRMED', role: 'ORGANISER', shareSlot: slot, cancellationReason: null, cancelledAt: null },
        });
      } else {
        await tx.sessionParticipant.create({
          data: { sessionId, userId, role: 'ORGANISER', status: 'CONFIRMED', shareSlot: slot },
        });
      }
      const count = session.confirmedCount + 1;
      const updated = await tx.session.update({
        where: { id: sessionId },
        data: {
          organiserIsPlaying: true,
          confirmedCount: count,
          status: count >= session.capacity ? 'FULL' : 'OPEN',
          version: { increment: 1 },
        },
        include: sessionInclude,
      });
      return toSummary(updated, now);
    }

    if (existing && (existing.status === 'CONFIRMED' || existing.status === 'ATTENDED')) {
      await tx.sessionParticipant.update({
        where: { id: existing.id },
        data: { status: 'CANCELLED', shareSlot: null, cancellationReason: 'LEFT', cancelledAt: now },
      });
    }
    const count = Math.max(0, session.confirmedCount - 1);
    const updated = await tx.session.update({
      where: { id: sessionId },
      data: { organiserIsPlaying: false, confirmedCount: count, status: 'OPEN', version: { increment: 1 } },
      include: sessionInclude,
    });
    return toSummary(updated, now);
  });
}

export async function decideMinPlayers(ctx: SessionCtx, sessionId: string, userId: string, decision: 'PROCEED' | 'CANCEL') {
  const session = await requireOrganiser(ctx, sessionId, userId);
  const now = ctx.now();
  if (session.minPlayers == null || session.minPlayersDecisionDeadline == null) {
    throw new AppError('INVALID_STATE_TRANSITION', 'This session has no minimum-player decision.');
  }
  if (now >= session.minPlayersDecisionDeadline) {
    throw new AppError('DEADLINE_PASSED', 'The decision deadline has passed.');
  }
  if (session.confirmedCount >= session.minPlayers) {
    throw new AppError('INVALID_STATE_TRANSITION', 'The minimum is already met.');
  }
  if (decision === 'CANCEL') {
    return cancelSession(ctx, sessionId, userId, 'MINIMUM_NOT_MET_ORGANISER_CANCELLED');
  }
  const updated = await ctx.db.session.update({
    where: { id: sessionId },
    data: { minPlayersDecision: 'PROCEED', minPlayersDecidedAt: now, version: { increment: 1 } },
    include: sessionInclude,
  });
  return toSummary(updated, now);
}

export async function listEvents(ctx: SessionCtx, sessionId: string, userId: string) {
  await requireOrganiser(ctx, sessionId, userId);
  return ctx.db.sessionEvent.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
}

export async function mySessions(
  ctx: SessionCtx,
  userId: string,
  role: 'organised' | 'joined' | 'interested',
  bucket: 'upcoming' | 'completed' | 'cancelled',
) {
  const now = ctx.now();
  if (role === 'interested') {
    const interests = await ctx.db.sessionInterest.findMany({
      where: { userId },
      include: { session: { include: sessionInclude } },
    });
    return interests.map((row) => toSummary(row.session, now));
  }
  const statusFilter =
    bucket === 'cancelled'
      ? { status: 'CANCELLED' as const }
      : bucket === 'completed'
        ? { status: { in: ['COMPLETED' as const, 'EXPIRED' as const] } }
        : { status: { in: ['OPEN' as const, 'FULL' as const] } };

  if (role === 'organised') {
    const rows = await ctx.db.session.findMany({
      where: { organiserId: userId, ...statusFilter },
      include: sessionInclude,
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((row) => toSummary(row, now));
  }
  const rows = await ctx.db.sessionParticipant.findMany({
    where: {
      userId,
      role: 'PLAYER',
      session: statusFilter,
    },
    include: { session: { include: sessionInclude } },
  });
  return rows.map((row) => toSummary(row.session, now));
}

export async function proposeVenueOption(
  ctx: SessionCtx,
  sessionId: string,
  actorId: string,
  input: { venueId: string; startsAt: string; endsAt: string; totalCostFils: number; notes?: string },
) {
  const session = await ctx.db.session.findUnique({ where: { id: sessionId }, include: { arrangement: true } });
  if (!session?.arrangement) throw new AppError('NOT_FOUND', 'No venue arrangement.');
  const venue = await ctx.db.venue.findUnique({ where: { id: input.venueId } });
  if (!venue) throw new AppError('NOT_FOUND', 'Unknown venue.');
  const option = await ctx.db.venueOption.create({
    data: {
      arrangementId: session.arrangement.id,
      venueId: venue.id,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      totalCostFils: input.totalCostFils,
      notes: input.notes,
      proposedById: actorId,
    },
  });
  await ctx.db.venueArrangement.update({
    where: { id: session.arrangement.id },
    data: { status: 'OPTIONS_PROPOSED' },
  });
  await notify(ctx.db, {
    userId: session.organiserId,
    type: 'VENUE_OPTIONS_PROPOSED',
    title: 'Venue option proposed',
    body: 'A venue option is ready for your session.',
    sessionId,
    actorId,
  });
  emitToUser(session.organiserId, 'venue_arrangement:updated', {
    sessionId,
    status: 'OPTIONS_PROPOSED',
    optionsCount: 1,
  });
  return option;
}

export async function decideVenueOption(ctx: SessionCtx, sessionId: string, userId: string, optionId: string, approve: boolean) {
  const session = await requireOrganiser(ctx, sessionId, userId);
  const option = await ctx.db.venueOption.findFirst({
    where: { id: optionId, arrangement: { sessionId } },
  });
  if (!option || option.status !== 'PROPOSED') throw new AppError('NOT_FOUND', 'Unknown venue option.');
  const now = ctx.now();
  if (approve) {
    await ctx.db.$transaction([
      ctx.db.venueOption.update({ where: { id: optionId }, data: { status: 'APPROVED', decidedAt: now } }),
      ctx.db.venueOption.updateMany({
        where: { arrangementId: option.arrangementId, id: { not: optionId }, status: 'PROPOSED' },
        data: { status: 'WITHDRAWN', decidedAt: now },
      }),
      ctx.db.venueArrangement.update({
        where: { sessionId },
        data: { status: 'APPROVED' },
      }),
    ]);
  } else {
    await ctx.db.venueOption.update({ where: { id: optionId }, data: { status: 'REJECTED', decidedAt: now } });
  }
  return toSummary(session, now);
}

export async function getVenueArrangement(ctx: SessionCtx, sessionId: string, userId: string) {
  const session = await requireOrganiser(ctx, sessionId, userId);
  const arrangement = await ctx.db.venueArrangement.findUnique({
    where: { sessionId },
    include: {
      options: { include: { venue: true } },
      session: { include: { booking: true } },
    },
  });
  if (!arrangement) throw new AppError('NOT_FOUND', 'No venue arrangement.');
  return {
    id: arrangement.id,
    status: arrangement.status,
    assignedToId: arrangement.assignedToId,
    closedReason: arrangement.closedReason,
    session: { id: session.id, title: session.title },
    booking: arrangement.session.booking,
    options: arrangement.options,
  };
}

export async function patchVenueBooking(
  ctx: SessionCtx,
  sessionId: string,
  userId: string,
  input: { bookingReference?: string; venuePaymentStatus?: 'NOT_PAID' | 'PAID' },
) {
  await requireOrganiser(ctx, sessionId, userId);
  const booking = await ctx.db.venueBooking.findUnique({ where: { sessionId } });
  if (!booking) throw new AppError('NOT_FOUND', 'No venue booking recorded.');
  return ctx.db.venueBooking.update({
    where: { sessionId },
    data: {
      ...(input.bookingReference !== undefined ? { bookingReference: input.bookingReference } : {}),
      ...(input.venuePaymentStatus
        ? {
            venuePaymentStatus: input.venuePaymentStatus,
            venuePaidAt: input.venuePaymentStatus === 'PAID' ? ctx.now() : null,
          }
        : {}),
    },
  });
}

export async function recordVenueBooking(
  ctx: SessionCtx,
  sessionId: string,
  userId: string,
  input: {
    venueOptionId: string;
    totalCostFils?: number;
    startsAt?: string;
    endsAt?: string;
    bookingReference?: string;
    venuePaymentStatus?: 'NOT_PAID' | 'PAID';
  },
  opts: { asStaff?: boolean } = {},
) {
  const now = ctx.now();
  const summary = await ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({
      where: { id: sessionId },
      include: { arrangement: { include: { options: true } }, participants: true },
    });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    if (!opts.asStaff && session.organiserId !== userId) {
      throw new AppError('NOT_ORGANISER', 'Only the organiser can do this.');
    }
    if (session.venueConfirmationStatus === 'CONFIRMED') {
      throw new AppError('VENUE_ALREADY_CONFIRMED', 'Venue is already confirmed.');
    }
    const option = session.arrangement?.options.find((row) => row.id === input.venueOptionId && row.status === 'APPROVED');
    if (!option) throw new AppError('VENUE_NOT_CONFIRMED', 'Approve a venue option first.');
    const venue = await tx.venue.findUnique({ where: { id: option.venueId } });
    if (!venue) throw new AppError('NOT_FOUND', 'Unknown venue.');
    const startsAt = input.startsAt ? new Date(input.startsAt) : option.startsAt;
    const endsAt = input.endsAt ? new Date(input.endsAt) : option.endsAt;
    const totalCostFils = input.totalCostFils ?? option.totalCostFils;
    try {
      assertPaidShare(totalCostFils, session.capacity, SETTINGS['payments.min_paid_share_fils']);
    } catch (error) {
      mapRule(error);
    }

    await tx.venueBooking.create({
      data: {
        sessionId,
        venueId: venue.id,
        venueOptionId: option.id,
        startsAt,
        endsAt,
        totalCostFils,
        bookingReference: input.bookingReference,
        venuePaymentStatus: input.venuePaymentStatus ?? 'NOT_PAID',
        recordedById: userId,
      },
    });
    await tx.venueArrangement.update({
      where: { sessionId },
      data: { status: 'BOOKED' },
    });
    const updated = await tx.session.update({
      where: { id: sessionId },
      data: {
        venueId: venue.id,
        latitude: venue.latitude,
        longitude: venue.longitude,
        locationPrecision: 'EXACT',
        timezone: venue.timezone,
        startsAt,
        endsAt,
        totalCostFils,
        shareMaxFils: maxShare(totalCostFils, session.capacity),
        venueConfirmationStatus: 'CONFIRMED',
        venueConfirmedAt: now,
        version: { increment: 1 },
      },
      include: sessionInclude,
    });
    const interests = await tx.sessionInterest.findMany({ where: { sessionId } });
    await notifyMany(
      tx,
      [session.organiserId, ...interests.map((row) => row.userId)],
      {
        type: 'SESSION_JOINABLE',
        title: 'Venue confirmed',
        body: 'This session is now joinable.',
        sessionId,
        actorId: userId,
      },
    );
    await tx.sessionEvent.create({
      data: { sessionId, actorId: userId, type: 'VENUE_CONFIRMED' },
    });
    return toSummary(updated, now);
  });
  emitVenueConfirmed(summary);
  return summary;
}
