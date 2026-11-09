import type { FavouriteSportsBody, PatchMeBody } from '@playaround/contracts';
import { Prisma } from '../../generated/prisma/client';
import { AppError } from '../../lib/errors';
import { hashSecret, sixDigitCode } from '../../lib/hash';
import type { SmsGateway } from '../../lib/sms';
import { verifyPassword } from '../../lib/password';
import type { AuthContext } from '../auth/auth.service';
import { revokeAll, toAuthUser } from '../auth/auth.service';

export interface UserContext extends AuthContext {
  sms: SmsGateway;
}

async function load(ctx: UserContext, userId: string) {
  const user = await ctx.db.user.findUnique({
    where: { id: userId },
    include: { profile: true, identities: true, favouriteSports: true },
  });
  if (!user || user.status === 'DELETED') throw new AppError('NOT_FOUND', 'User not found.');
  return user;
}

export async function getMe(ctx: UserContext, userId: string) {
  const user = await load(ctx, userId);
  return {
    ...toAuthUser(user),
    favouriteSports: user.favouriteSports.map((row) => ({
      sportId: row.sportId,
      skillLevel: row.skillLevel,
    })),
  };
}

export async function patchMe(ctx: UserContext, userId: string, input: PatchMeBody) {
  await ctx.db.userProfile.update({
    where: { userId },
    data: {
      displayName: input.displayName,
      bio: input.bio === undefined ? undefined : input.bio,
      avatarUrl: input.avatarUrl === undefined ? undefined : input.avatarUrl,
      homeAreaLabel: input.homeAreaLabel === undefined ? undefined : input.homeAreaLabel,
      defaultRadiusKm: input.defaultRadiusKm,
      notificationPrefs:
        input.notificationPrefs === undefined
          ? undefined
          : input.notificationPrefs === null
            ? Prisma.DbNull
            : (input.notificationPrefs as Prisma.InputJsonValue),
    },
  });
  return getMe(ctx, userId);
}

export async function setFavouriteSports(ctx: UserContext, userId: string, items: FavouriteSportsBody) {
  const ids = items.map((item) => item.sportId);
  if (ids.length > 0) {
    const sports = await ctx.db.sport.findMany({ where: { id: { in: ids }, isActive: true } });
    if (sports.length !== ids.length) throw new AppError('NOT_FOUND', 'Unknown sport.');
  }
  await ctx.db.$transaction([
    ctx.db.userFavouriteSport.deleteMany({ where: { userId } }),
    ...items.map((item) =>
      ctx.db.userFavouriteSport.create({
        data: { userId, sportId: item.sportId, skillLevel: item.skillLevel },
      }),
    ),
  ]);
  return getMe(ctx, userId);
}

export async function requestPhoneCode(ctx: UserContext, userId: string, phone: string) {
  const taken = await ctx.db.user.findFirst({
    where: { phone, id: { not: userId }, status: { not: 'DELETED' } },
  });
  if (taken) throw new AppError('PHONE_TAKEN', 'That phone number is already in use.');

  const hourAgo = new Date(ctx.now().getTime() - 60 * 60 * 1000);
  const sends = await ctx.db.verificationCode.count({
    where: {
      purpose: 'PHONE_VERIFY',
      createdAt: { gt: hourAgo },
      OR: [{ userId }, { target: phone }],
    },
  });
  if (sends >= 3) throw new AppError('RATE_LIMITED', 'You can request three codes per hour.');

  await ctx.db.user.update({
    where: { id: userId },
    data: { phone, phoneVerifiedAt: null },
  });

  const code = sixDigitCode();
  await ctx.db.verificationCode.create({
    data: {
      userId,
      purpose: 'PHONE_VERIFY',
      target: phone,
      codeHash: hashSecret(ctx.env.JWT_SECRET, `${userId}:PHONE_VERIFY:${code}`),
      expiresAt: new Date(ctx.now().getTime() + 10 * 60 * 1000),
    },
  });
  await ctx.sms.send(phone, `Your PlayAround code is ${code}`);
}

export async function verifyPhone(ctx: UserContext, userId: string, code: string) {
  const row = await ctx.db.verificationCode.findFirst({
    where: {
      userId,
      purpose: 'PHONE_VERIFY',
      consumedAt: null,
      expiresAt: { gt: ctx.now() },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new AppError('VALIDATION_ERROR', 'Invalid or expired code.');
  if (row.attempts >= 5) {
    throw new AppError('VALIDATION_ERROR', 'Too many attempts. Request a new code.');
  }
  const match = row.codeHash === hashSecret(ctx.env.JWT_SECRET, `${userId}:PHONE_VERIFY:${code}`);
  if (!match) {
    await ctx.db.verificationCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('VALIDATION_ERROR', 'Invalid or expired code.');
  }
  await ctx.db.verificationCode.update({ where: { id: row.id }, data: { consumedAt: ctx.now() } });
  await ctx.db.user.update({
    where: { id: userId },
    data: { phone: row.target, phoneVerifiedAt: ctx.now() },
  });
}

export async function upsertDevice(
  ctx: UserContext,
  userId: string,
  input: { platform: 'IOS' | 'ANDROID' | 'WEB'; pushToken: string },
) {
  await ctx.db.device.upsert({
    where: { pushToken: input.pushToken },
    create: { userId, platform: input.platform, pushToken: input.pushToken },
    update: { userId, platform: input.platform, lastSeenAt: ctx.now() },
  });
}

export async function removeDevice(ctx: UserContext, userId: string, pushToken: string) {
  await ctx.db.device.deleteMany({ where: { userId, pushToken } });
}

export async function getPublicProfile(ctx: UserContext, id: string) {
  const user = await ctx.db.user.findUnique({
    where: { id },
    include: { profile: true },
  });
  if (!user || user.status !== 'ACTIVE' || !user.profile) {
    throw new AppError('NOT_FOUND', 'User not found.');
  }
  return {
    id: user.id,
    displayName: user.profile.displayName,
    avatarUrl: user.profile.avatarUrl,
    bio: user.profile.bio,
    ratingAvg: Number(user.profile.ratingAvg),
    ratingCount: user.profile.ratingCount,
    role: user.role === 'USER' ? 'USER' : user.role,
  };
}

export async function deleteAccount(ctx: UserContext, userId: string, password: string | undefined) {
  const user = await load(ctx, userId);
  if (user.passwordHash) {
    if (!password || !(await verifyPassword(user.passwordHash, password))) {
      throw new AppError('UNAUTHENTICATED', 'Password required to delete this account.');
    }
  }

  const upcoming = await ctx.db.session.count({
    where: {
      organiserId: userId,
      status: { in: ['OPEN', 'FULL'] },
      startsAt: { gt: ctx.now() },
    },
  });
  const disputes = await ctx.db.paymentDispute.count({
    where: { openedById: userId, status: 'OPEN' },
  });
  if (upcoming > 0 || disputes > 0) {
    throw new AppError('INVALID_STATE_TRANSITION', 'Cannot delete this account yet.', {
      organisesUpcomingSessions: upcoming > 0,
      openPaymentDisputes: disputes > 0,
    });
  }

  await ctx.db.sessionParticipant.updateMany({
    where: {
      userId,
      status: 'CONFIRMED',
      session: { startsAt: { gt: ctx.now() }, status: { in: ['OPEN', 'FULL'] } },
    },
      data: { status: 'CANCELLED', cancellationReason: 'LEFT' },
  });

  await revokeAll(ctx, userId);
  await ctx.db.authIdentity.deleteMany({ where: { userId } });
  await ctx.db.device.deleteMany({ where: { userId } });
  await ctx.db.userProfile.update({
    where: { userId },
    data: {
      displayName: 'Deleted user',
      avatarUrl: null,
      bio: null,
      homeAreaLabel: null,
      homeLatitude: null,
      homeLongitude: null,
      notificationPrefs: Prisma.DbNull,
    },
  });
  await ctx.db.user.update({
    where: { id: userId },
    data: {
      email: `deleted+${userId}@tombstone.playaround.invalid`,
      passwordHash: null,
      phone: null,
      phoneVerifiedAt: null,
      emailVerifiedAt: null,
      status: 'DELETED',
      deletedAt: ctx.now(),
    },
  });
}
