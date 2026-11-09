import { AppError } from '../../lib/errors';
import type { Database } from '../../lib/prisma';
import { cancelSession, type SessionCtx } from './session.service';
import { leaveSession } from './join.service';

export function jobCtx(db: Database, now = () => new Date()): SessionCtx {
  return { db, now };
}

export async function runCompletionJob(db: Database, now = new Date()) {
  const due = await db.session.findMany({
    where: { status: { in: ['OPEN', 'FULL'] }, endsAt: { lte: now } },
    select: { id: true, venueConfirmationStatus: true, confirmedCount: true },
  });
  for (const session of due) {
    const complete =
      session.venueConfirmationStatus === 'CONFIRMED' && session.confirmedCount >= 2;
    await db.session.update({
      where: { id: session.id },
      data: {
        status: complete ? 'COMPLETED' : 'EXPIRED',
        closedAt: now,
        version: { increment: 1 },
      },
    });
    await db.sessionEvent.create({
      data: { sessionId: session.id, type: complete ? 'COMPLETED' : 'EXPIRED' },
    });
  }
  return due.length;
}

export async function runMinPlayersJob(db: Database, now = new Date()) {
  const due = await db.session.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      minPlayers: { not: null },
      minPlayersDecision: null,
      minPlayersDecisionDeadline: { lte: now },
    },
  });
  let cancelled = 0;
  for (const session of due) {
    if (session.minPlayers != null && session.confirmedCount >= session.minPlayers) continue;
    await cancelSession(jobCtx(db, () => now), session.id, session.organiserId, 'MINIMUM_NOT_MET_NO_DECISION');
    cancelled += 1;
  }
  return cancelled;
}

export async function runVenueDeadlineJob(db: Database, now = new Date()) {
  const due = await db.session.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      venueConfirmationStatus: 'PENDING',
      venueConfirmDeadline: { lte: now },
    },
  });
  for (const session of due) {
    await db.session.update({
      where: { id: session.id },
      data: { venueConfirmationStatus: 'LAPSED' },
    });
    await db.venueArrangement.updateMany({
      where: { sessionId: session.id },
      data: { status: 'UNSUCCESSFUL', closedReason: 'Venue confirmation deadline passed' },
    });
    await cancelSession(jobCtx(db, () => now), session.id, session.organiserId, 'VENUE_NOT_CONFIRMED');
  }
  return due.length;
}

export async function runPriceConsentExpiryJob(db: Database, now = new Date()) {
  const due = await db.priceConsent.findMany({
    where: { status: 'PENDING', priceChange: { consentDeadline: { lte: now } } },
    include: { participant: true, priceChange: true },
  });
  for (const consent of due) {
    await db.priceConsent.update({
      where: { id: consent.id },
      data: { status: 'EXPIRED', respondedAt: now },
    });
    try {
      await leaveSession(
        jobCtx(db, () => now),
        consent.priceChange.sessionId,
        consent.participant.userId,
        'PRICE_NOT_ACCEPTED',
      );
    } catch (error) {
      if (!(error instanceof AppError)) throw error;
    }
  }
  return due.length;
}

export function sessionJobs(db: Database) {
  return [
    {
      name: 'session.completion',
      intervalMs: 60_000,
      run: async () => {
        await runCompletionJob(db);
      },
    },
    {
      name: 'session.min-players',
      intervalMs: 60_000,
      run: async () => {
        await runMinPlayersJob(db);
      },
    },
    {
      name: 'session.venue-deadline',
      intervalMs: 60_000,
      run: async () => {
        await runVenueDeadlineJob(db);
      },
    },
    {
      name: 'session.price-consent-expiry',
      intervalMs: 60_000,
      run: async () => {
        await runPriceConsentExpiryJob(db);
      },
    },
  ];
}
