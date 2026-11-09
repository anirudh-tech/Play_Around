import type { NotificationType } from '@playaround/contracts';
import type { Database } from '../../lib/prisma';
import { notify } from '../../lib/notify';

const HOUR = 60 * 60 * 1000;

async function alreadySent(
  db: Database,
  userId: string,
  sessionId: string,
  type: NotificationType,
  since: Date,
) {
  const existing = await db.notification.findFirst({
    where: { userId, sessionId, type, createdAt: { gte: since } },
    select: { id: true },
  });
  return Boolean(existing);
}

function windowAround(center: Date, slackMs: number) {
  return {
    gte: new Date(center.getTime() - slackMs),
    lte: new Date(center.getTime() + slackMs),
  };
}

export async function runReminderJob(db: Database, now = new Date()) {
  let sent = 0;
  const upcoming = await db.session.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      startsAt: { gt: now, lte: new Date(now.getTime() + 26 * HOUR) },
    },
    include: {
      participants: { where: { status: { in: ['CONFIRMED', 'ATTENDED'] } } },
      payments: true,
    },
  });

  for (const session of upcoming) {
    const hoursToStart = (session.startsAt.getTime() - now.getTime()) / HOUR;
    for (const participant of session.participants) {
      if (hoursToStart <= 25 && hoursToStart >= 23) {
        if (!(await alreadySent(db, participant.userId, session.id, 'SESSION_REMINDER', new Date(now.getTime() - 6 * HOUR)))) {
          await notify(db, {
            userId: participant.userId,
            type: 'SESSION_REMINDER',
            title: 'Session tomorrow',
            body: 'Your session starts in about 24 hours.',
            sessionId: session.id,
          });
          sent += 1;
        }
      }
      if (hoursToStart <= 1.2 && hoursToStart >= 0.7) {
        if (!(await alreadySent(db, participant.userId, session.id, 'SESSION_REMINDER', new Date(now.getTime() - 2 * HOUR)))) {
          await notify(db, {
            userId: participant.userId,
            type: 'SESSION_REMINDER',
            title: 'Session in an hour',
            body: 'Your session starts in about an hour.',
            sessionId: session.id,
          });
          sent += 1;
        }
      }
    }

    if (hoursToStart <= 25 && hoursToStart >= 23) {
      for (const payment of session.payments) {
        if (payment.status !== 'UNPAID') continue;
        if (await alreadySent(db, payment.payerId, session.id, 'PAYMENT_REMINDER', new Date(now.getTime() - 12 * HOUR))) {
          continue;
        }
        await notify(db, {
          userId: payment.payerId,
          type: 'PAYMENT_REMINDER',
          title: 'Pay the organiser',
          body: 'You still have an unpaid share for a session starting tomorrow.',
          sessionId: session.id,
          entityType: 'payment',
          entityId: payment.id,
        });
        sent += 1;
      }
    }
  }

  const minDue = await db.session.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      minPlayersDecision: null,
      minPlayersDecisionDeadline: {
        not: null,
        gte: now,
        lte: new Date(now.getTime() + 7 * HOUR),
      },
    },
  });
  for (const session of minDue) {
    if (session.minPlayers != null && session.confirmedCount >= session.minPlayers) continue;
    if (await alreadySent(db, session.organiserId, session.id, 'MIN_PLAYERS_DECISION_REQUIRED', new Date(now.getTime() - 5 * HOUR))) {
      continue;
    }
    await notify(db, {
      userId: session.organiserId,
      type: 'MIN_PLAYERS_DECISION_REQUIRED',
      title: 'Minimum players decision',
      body: 'Decide whether to continue or cancel before the deadline.',
      sessionId: session.id,
    });
    sent += 1;
  }

  const venueDue = await db.session.findMany({
    where: {
      status: { in: ['OPEN', 'FULL'] },
      venueConfirmationStatus: 'PENDING',
      venueConfirmDeadline: { gte: now, lte: new Date(now.getTime() + 7 * HOUR) },
    },
  });
  for (const session of venueDue) {
    if (await alreadySent(db, session.organiserId, session.id, 'VENUE_DEADLINE_APPROACHING', new Date(now.getTime() - 5 * HOUR))) {
      continue;
    }
    await notify(db, {
      userId: session.organiserId,
      type: 'VENUE_DEADLINE_APPROACHING',
      title: 'Venue deadline approaching',
      body: 'Confirm a venue before this session lapses.',
      sessionId: session.id,
    });
    sent += 1;
  }

  const consents = await db.priceConsent.findMany({
    where: { status: 'PENDING', priceChange: { consentDeadline: windowAround(new Date(now.getTime() + 6 * HOUR), 30 * 60 * 1000) } },
    include: { participant: true, priceChange: true },
  });
  for (const consent of consents) {
    if (
      await alreadySent(
        db,
        consent.participant.userId,
        consent.priceChange.sessionId,
        'PRICE_CONSENT_REMINDER',
        new Date(now.getTime() - 5 * HOUR),
      )
    ) {
      continue;
    }
    await notify(db, {
      userId: consent.participant.userId,
      type: 'PRICE_CONSENT_REMINDER',
      title: 'Price consent reminder',
      body: 'Accept the new share or leave the session.',
      sessionId: consent.priceChange.sessionId,
      entityType: 'price_consent',
      entityId: consent.id,
    });
    sent += 1;
  }

  return sent;
}

export function reminderJob(db: Database) {
  return {
    name: 'notifications.reminders',
    intervalMs: 5 * 60_000,
    run: async () => {
      await runReminderJob(db);
    },
  };
}
