import {
  PLATFORM_SETTING_DEFAULTS,
  type AdminCreateVenueBody,
  type AdminPatchSportBody,
  type AdminPatchVenueBody,
  type AdminSportBody,
  type PlatformSettingKey,
} from '@playaround/contracts';
import { AppError } from '../../lib/errors';
import { notify } from '../../lib/notify';
import type { Database } from '../../lib/prisma';
import { cancelSession, type SessionCtx } from '../sessions/session.service';

const ACTIVE = ['CONFIRMED', 'ATTENDED'] as const;

export async function overviewMetrics(db: Database, now: Date) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const start = new Date(`${day}T00:00:00+04:00`);
  const end = new Date(`${day}T23:59:59.999+04:00`);

  const [todaySessions, nearDeadline, openDisputes, minPlayerPending, openReports] = await Promise.all([
    db.session.findMany({
      where: { startsAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
      select: { confirmedCount: true, capacity: true },
    }),
    db.session.count({
      where: {
        venueConfirmationStatus: 'PENDING',
        status: { in: ['OPEN', 'FULL'] },
        venueConfirmDeadline: { gte: now, lte: new Date(now.getTime() + 6 * 60 * 60 * 1000) },
      },
    }),
    db.paymentDispute.count({ where: { status: 'OPEN' } }),
    db.session.count({
      where: {
        status: { in: ['OPEN', 'FULL'] },
        minPlayersDecision: null,
        minPlayersDecisionDeadline: { not: null, lte: now },
      },
    }),
    db.report.count({ where: { status: 'OPEN' } }),
  ]);

  const capacity = todaySessions.reduce((sum, row) => sum + row.capacity, 0);
  const confirmed = todaySessions.reduce((sum, row) => sum + row.confirmedCount, 0);
  return {
    sessionsToday: todaySessions.length,
    fillRate: capacity === 0 ? 0 : Math.round((confirmed / capacity) * 1000) / 10,
    venueRequestsNearDeadline: nearDeadline,
    openDisputes,
    minPlayerPending,
    openReports,
  };
}

export async function listUsers(db: Database, query: { q?: string; role?: string; status?: string }) {
  return db.user.findMany({
    where: {
      ...(query.role ? { role: query.role as 'USER' | 'SUPPORT' | 'OPERATIONS' | 'SUPER_ADMIN' } : {}),
      ...(query.status ? { status: query.status as 'ACTIVE' | 'SUSPENDED' | 'DELETED' } : {}),
      ...(query.q
        ? {
            OR: [
              { email: { contains: query.q } },
              { profile: { is: { displayName: { contains: query.q } } } },
            ],
          }
        : {}),
    },
    include: { profile: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

export async function getUser(db: Database, id: string) {
  const user = await db.user.findUnique({
    where: { id },
    include: {
      profile: true,
      identities: true,
      organisedSessions: { take: 10, orderBy: { startsAt: 'desc' }, select: { id: true, title: true, status: true, startsAt: true } },
      participations: {
        take: 10,
        orderBy: { joinedAt: 'desc' },
        select: { status: true, session: { select: { id: true, title: true, startsAt: true } } },
      },
    },
  });
  if (!user) throw new AppError('NOT_FOUND', 'User not found.');
  return user;
}

export async function setUserStatus(
  db: Database,
  actor: { id: string; role: string },
  userId: string,
  status: 'ACTIVE' | 'SUSPENDED',
) {
  if (userId === actor.id) throw new AppError('FORBIDDEN', 'You cannot change your own status.');
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found.');
  if (user.role !== 'USER' && actor.role !== 'SUPER_ADMIN') {
    throw new AppError('FORBIDDEN', 'Only a super admin can suspend staff.');
  }
  return db.user.update({
    where: { id: userId },
    data: { status, deletedAt: null },
    include: { profile: true },
  });
}

export async function setStaffRole(db: Database, actorId: string, userId: string, role: 'SUPPORT' | 'OPERATIONS' | 'SUPER_ADMIN') {
  if (userId === actorId) throw new AppError('FORBIDDEN', 'You cannot change your own role.');
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('NOT_FOUND', 'User not found.');
  return db.user.update({
    where: { id: userId },
    data: { role },
    include: { profile: true },
  });
}

export async function listStaff(db: Database) {
  return db.user.findMany({
    where: { role: { in: ['SUPPORT', 'OPERATIONS', 'SUPER_ADMIN'] }, status: 'ACTIVE' },
    include: { profile: true },
    orderBy: { email: 'asc' },
  });
}

export async function listAdminSessions(
  db: Database,
  query: { status?: string; type?: string; q?: string },
) {
  return db.session.findMany({
    where: {
      ...(query.status ? { status: query.status as 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED' } : {}),
      ...(query.type ? { sessionType: query.type as 'EXISTING_BOOKING' | 'LOOKING_FOR_PLAYERS' } : {}),
      ...(query.q ? { title: { contains: query.q } } : {}),
    },
    include: {
      sport: true,
      venue: true,
      organiser: { include: { profile: true } },
    },
    orderBy: { startsAt: 'desc' },
    take: 50,
  });
}

export async function getAdminSession(db: Database, id: string) {
  const session = await db.session.findUnique({
    where: { id },
    include: {
      sport: true,
      venue: true,
      organiser: { include: { profile: true } },
      participants: { include: { user: { include: { profile: true } }, payment: true } },
      events: { orderBy: { createdAt: 'asc' } },
      booking: true,
      arrangement: { include: { options: { include: { venue: true } } } },
    },
  });
  if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
  return session;
}

export async function adminCancelSession(ctx: SessionCtx, sessionId: string, actorId: string, reason: string) {
  return cancelSession(ctx, sessionId, actorId, 'ADMIN_CANCELLED', reason);
}

export async function adminRemoveParticipant(ctx: SessionCtx, sessionId: string, actorId: string, targetUserId: string) {
  const now = ctx.now();
  return ctx.db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId} FOR UPDATE`;
    const session = await tx.session.findUnique({ where: { id: sessionId }, include: { participants: true } });
    if (!session) throw new AppError('NOT_FOUND', 'Session not found.');
    const existing = session.participants.find((p) => p.userId === targetUserId);
    if (!existing || !ACTIVE.includes(existing.status as (typeof ACTIVE)[number])) {
      throw new AppError('NOT_A_PARTICIPANT', 'That player is not in this session.');
    }
    if (existing.role === 'ORGANISER') {
      throw new AppError('INVALID_STATE_TRANSITION', 'The organiser cannot be removed this way.');
    }
    await tx.sessionParticipant.update({
      where: { id: existing.id },
      data: {
        status: 'CANCELLED',
        shareSlot: null,
        cancellationReason: 'REMOVED_BY_ADMIN',
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
      body: 'Staff removed you from a session.',
      sessionId,
      actorId,
    });
  });
}

export async function listAdminSports(db: Database) {
  return db.sport.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function createSport(db: Database, body: AdminSportBody) {
  if (body.minPlayers > body.maxPlayers || body.defaultPlayers < body.minPlayers || body.defaultPlayers > body.maxPlayers) {
    throw new AppError('VALIDATION_ERROR', 'Player bounds are invalid.');
  }
  const taken = await db.sport.findUnique({ where: { slug: body.slug } });
  if (taken) {
    throw new AppError('VALIDATION_ERROR', 'A sport with that slug already exists.');
  }
  return db.sport.create({
    data: {
      slug: body.slug,
      name: body.name,
      iconKey: body.iconKey,
      accentColor: body.accentColor,
      minPlayers: body.minPlayers,
      maxPlayers: body.maxPlayers,
      defaultPlayers: body.defaultPlayers,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });
}

export async function patchSport(db: Database, id: number, body: AdminPatchSportBody) {
  const sport = await db.sport.findUnique({ where: { id } });
  if (!sport) throw new AppError('NOT_FOUND', 'Sport not found.');
  const minPlayers = body.minPlayers ?? sport.minPlayers;
  const maxPlayers = body.maxPlayers ?? sport.maxPlayers;
  const defaultPlayers = body.defaultPlayers ?? sport.defaultPlayers;
  if (minPlayers > maxPlayers || defaultPlayers < minPlayers || defaultPlayers > maxPlayers) {
    throw new AppError('VALIDATION_ERROR', 'Player bounds are invalid.');
  }
  return db.sport.update({
    where: { id },
    data: {
      ...(body.slug ? { slug: body.slug } : {}),
      ...(body.name ? { name: body.name } : {}),
      ...(body.iconKey ? { iconKey: body.iconKey } : {}),
      ...(body.accentColor ? { accentColor: body.accentColor } : {}),
      ...(body.minPlayers != null ? { minPlayers: body.minPlayers } : {}),
      ...(body.maxPlayers != null ? { maxPlayers: body.maxPlayers } : {}),
      ...(body.defaultPlayers != null ? { defaultPlayers: body.defaultPlayers } : {}),
      ...(body.isActive != null ? { isActive: body.isActive } : {}),
      ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
    },
  });
}

function staffVenue(row: {
  id: string;
  name: string;
  addressLine: string;
  area: string | null;
  city: string;
  latitude: { toString(): string } | number;
  longitude: { toString(): string } | number;
  isVerified: boolean;
  googlePlaceId: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bookingChannel: string | null;
  staffNotes: string | null;
  mergedIntoId: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    addressLine: row.addressLine,
    area: row.area,
    city: row.city,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    isVerified: row.isVerified,
    googlePlaceId: row.googlePlaceId,
    contactPhone: row.contactPhone,
    contactEmail: row.contactEmail,
    bookingChannel: row.bookingChannel,
    staffNotes: row.staffNotes,
    mergedIntoId: row.mergedIntoId,
  };
}

export async function listAdminVenues(db: Database, q?: string) {
  const rows = await db.venue.findMany({
    where: {
      mergedIntoId: null,
      ...(q ? { name: { contains: q } } : {}),
    },
    orderBy: { name: 'asc' },
    take: 80,
  });
  return rows.map(staffVenue);
}

export async function getAdminVenue(db: Database, id: string) {
  const row = await db.venue.findUnique({
    where: { id },
    include: { sports: { include: { sport: true } } },
  });
  if (!row) throw new AppError('NOT_FOUND', 'Venue not found.');
  return {
    ...staffVenue(row),
    sports: row.sports.map((link) => ({ id: link.sport.id, slug: link.sport.slug, name: link.sport.name })),
  };
}

export async function createAdminVenue(db: Database, actorId: string, body: AdminCreateVenueBody) {
  const venue = await db.venue.create({
    data: {
      googlePlaceId: body.googlePlaceId,
      name: body.name,
      addressLine: body.addressLine,
      area: body.area,
      city: body.city,
      countryCode: body.countryCode,
      latitude: body.latitude,
      longitude: body.longitude,
      isVerified: body.isVerified ?? false,
      contactPhone: body.contactPhone,
      contactEmail: body.contactEmail,
      bookingChannel: body.bookingChannel,
      staffNotes: body.staffNotes,
      createdById: actorId,
      sports: body.sportIds.length ? { create: body.sportIds.map((sportId) => ({ sportId })) } : undefined,
    },
  });
  return staffVenue(venue);
}

export async function patchAdminVenue(db: Database, id: string, body: AdminPatchVenueBody) {
  const current = await db.venue.findUnique({ where: { id } });
  if (!current || current.mergedIntoId) throw new AppError('NOT_FOUND', 'Venue not found.');
  const updated = await db.venue.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.addressLine ? { addressLine: body.addressLine } : {}),
      ...(body.area !== undefined ? { area: body.area } : {}),
      ...(body.city ? { city: body.city } : {}),
      ...(body.latitude != null ? { latitude: body.latitude } : {}),
      ...(body.longitude != null ? { longitude: body.longitude } : {}),
      ...(body.isVerified != null ? { isVerified: body.isVerified } : {}),
      ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
      ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
      ...(body.bookingChannel !== undefined ? { bookingChannel: body.bookingChannel } : {}),
      ...(body.staffNotes !== undefined ? { staffNotes: body.staffNotes } : {}),
    },
  });
  return staffVenue(updated);
}

export async function mergeVenues(db: Database, fromId: string, intoId: string) {
  if (fromId === intoId) throw new AppError('VALIDATION_ERROR', 'Choose a different venue to merge into.');
  return db.$transaction(async (tx) => {
    const from = await tx.venue.findUnique({ where: { id: fromId }, include: { sports: true } });
    const into = await tx.venue.findUnique({ where: { id: intoId }, include: { sports: true } });
    if (!from || !into || from.mergedIntoId || into.mergedIntoId) {
      throw new AppError('NOT_FOUND', 'Venue not found.');
    }
    const existing = new Set(into.sports.map((row) => row.sportId));
    for (const link of from.sports) {
      if (!existing.has(link.sportId)) {
        await tx.venueSport.create({ data: { venueId: intoId, sportId: link.sportId } });
      }
    }
    await tx.venueSport.deleteMany({ where: { venueId: fromId } });
    await tx.session.updateMany({ where: { venueId: fromId }, data: { venueId: intoId } });
    await tx.venueOption.updateMany({ where: { venueId: fromId }, data: { venueId: intoId } });
    await tx.venueBooking.updateMany({ where: { venueId: fromId }, data: { venueId: intoId } });
    await tx.venue.update({ where: { id: fromId }, data: { mergedIntoId: intoId } });
    return getAdminVenue(tx as unknown as Database, intoId);
  });
}

export async function listReports(db: Database, status?: string) {
  return db.report.findMany({
    where: status ? { status: status as 'OPEN' | 'ACTIONED' | 'DISMISSED' } : {},
    include: { reporter: { include: { profile: true } }, resolvedBy: { include: { profile: true } } },
    orderBy: { createdAt: 'asc' },
    take: 80,
  });
}

export async function patchReport(
  db: Database,
  id: string,
  actorId: string,
  input: { status: 'ACTIONED' | 'DISMISSED'; resolution: string },
) {
  const current = await db.report.findUnique({ where: { id } });
  if (!current) throw new AppError('NOT_FOUND', 'Report not found.');
  if (current.status !== 'OPEN') throw new AppError('INVALID_STATE_TRANSITION', 'This report is already closed.');
  return db.report.update({
    where: { id },
    data: {
      status: input.status,
      resolution: input.resolution,
      resolvedById: actorId,
      resolvedAt: new Date(),
    },
  });
}

export async function listReviews(db: Database, hidden?: boolean) {
  return db.review.findMany({
    where: hidden == null ? {} : { isHidden: hidden },
    include: {
      reviewer: { include: { profile: true } },
      reviewee: { include: { profile: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 80,
  });
}

export async function hideReview(db: Database, id: string, isHidden: boolean) {
  const review = await db.review.findUnique({ where: { id } });
  if (!review) throw new AppError('NOT_FOUND', 'Review not found.');
  const updated = await db.review.update({ where: { id }, data: { isHidden } });
  const agg = await db.review.aggregate({
    where: { revieweeId: review.revieweeId, isHidden: false },
    _avg: { rating: true },
    _count: true,
  });
  await db.userProfile.update({
    where: { userId: review.revieweeId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
  });
  return updated;
}

let settingsCache: { at: number; value: Record<string, number> } | null = null;

export async function getSettings(db: Database) {
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.value;
  const rows = await db.platformSetting.findMany();
  const value = { ...PLATFORM_SETTING_DEFAULTS } as Record<string, number>;
  for (const row of rows) {
    if (typeof row.value === 'number') value[row.key] = row.value;
  }
  settingsCache = { at: Date.now(), value };
  return value;
}

export async function putSetting(db: Database, actorId: string, key: PlatformSettingKey, value: number) {
  if (!(key in PLATFORM_SETTING_DEFAULTS)) throw new AppError('VALIDATION_ERROR', 'Unknown setting.');
  await db.platformSetting.upsert({
    where: { key },
    update: { value, updatedById: actorId },
    create: { key, value, updatedById: actorId },
  });
  settingsCache = null;
  return getSettings(db);
}

export async function listAuditLogs(
  db: Database,
  query: { action?: string; actorId?: string; targetType?: string },
) {
  return db.adminAuditLog.findMany({
    where: {
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
    },
    include: { actor: { include: { profile: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
