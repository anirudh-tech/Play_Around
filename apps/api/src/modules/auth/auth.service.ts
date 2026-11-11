import { STAFF_ROLES, type AuthUser as AuthUserDto, type ClientKind } from '@playaround/contracts';
import { randomUUID } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../../config/env';
import { AppError } from '../../lib/errors';
import { hashSecret, randomToken, sixDigitCode } from '../../lib/hash';
import type { Mailer } from '../../lib/mailer';
import { otpEmail } from '../../lib/otp-email';
import type { ClerkVerifier } from '../../lib/clerk';
import type { OauthVerifier, SocialProfile } from '../../lib/oauth';
import { hashPassword, verifyPassword } from '../../lib/password';
import type { Database } from '../../lib/prisma';
import { signAccessToken } from '../../lib/tokens';
import { ADMIN_REFRESH_COOKIE, isMobileClient, REFRESH_COOKIE } from '../../middleware/client';

type UserRow = {
  id: string;
  email: string;
  passwordHash: string | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  emailVerifiedAt: Date | null;
  role: AuthUserDto['role'];
  status: AuthUserDto['status'];
  profile: {
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    homeAreaLabel: string | null;
    defaultRadiusKm: number;
    notificationPrefs: unknown;
    ratingAvg: { toString(): string } | number;
    ratingCount: number;
  } | null;
  identities: { provider: 'GOOGLE' | 'APPLE'; providerUserId: string; email: string | null }[];
};

export interface AuthContext {
  db: Database;
  env: Env;
  mailer: Mailer;
  oauth: OauthVerifier;
  clerk?: ClerkVerifier;
  now: () => Date;
}

function cookieOpts(env: Env, maxAgeSeconds: number): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

export function toAuthUser(user: UserRow): AuthUserDto {
  const profile = user.profile;
  if (!profile) throw new AppError('INTERNAL_ERROR', 'User profile missing.');
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    phoneVerifiedAt: user.phoneVerifiedAt?.toISOString() ?? null,
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    role: user.role,
    status: user.status,
    profile: {
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      homeAreaLabel: profile.homeAreaLabel,
      defaultRadiusKm: profile.defaultRadiusKm,
      notificationPrefs: profile.notificationPrefs,
      ratingAvg: Number(profile.ratingAvg),
      ratingCount: profile.ratingCount,
    },
  };
}

async function loadUser(db: Database, id: string): Promise<UserRow> {
  const user = await db.user.findUnique({
    where: { id },
    include: { profile: true, identities: true },
  });
  if (!user) throw new AppError('UNAUTHENTICATED', 'Sign in required.');
  return user;
}

export async function issueSession(
  ctx: AuthContext,
  user: UserRow,
  res: Response,
  client: ClientKind,
  audience: 'app' | 'admin',
) {
  if (user.status === 'SUSPENDED') {
    throw new AppError('ACCOUNT_SUSPENDED', 'This account is suspended.');
  }
  if (user.status === 'DELETED') {
    throw new AppError('UNAUTHENTICATED', 'Sign in required.');
  }
  const ttl = audience === 'admin' ? ctx.env.ADMIN_REFRESH_TTL_SECONDS : ctx.env.REFRESH_TTL_SECONDS;
  const expiresAt = new Date(ctx.now().getTime() + ttl * 1000);
  const refresh = randomToken();
  const familyId = randomUUID();
  await ctx.db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashSecret(ctx.env.JWT_SECRET, refresh),
      familyId,
      audience,
      userAgent: undefined,
      expiresAt,
    },
  });
  await ctx.db.user.update({ where: { id: user.id }, data: { lastLoginAt: ctx.now() } });

  const { token, expiresIn } = await signAccessToken(ctx.env, {
    sub: user.id,
    role: user.role,
    scope: audience,
  });

  const cookieName = audience === 'admin' ? ADMIN_REFRESH_COOKIE : REFRESH_COOKIE;
  res.cookie(cookieName, refresh, cookieOpts(ctx.env, ttl));

  return {
    accessToken: token,
    refreshToken: isMobileClient(client) ? refresh : undefined,
    expiresIn,
    user: toAuthUser(user),
  };
}

export async function rotateRefresh(
  ctx: AuthContext,
  presented: string | undefined,
  res: Response,
  client: ClientKind,
  audience: 'app' | 'admin',
) {
  if (!presented) throw new AppError('UNAUTHENTICATED', 'Refresh token missing.');
  const tokenHash = hashSecret(ctx.env.JWT_SECRET, presented);
  const existing = await ctx.db.refreshToken.findUnique({ where: { tokenHash } });
  if (!existing || existing.audience !== audience) {
    throw new AppError('UNAUTHENTICATED', 'Invalid refresh token.');
  }
  if (existing.revokedAt) {
    await ctx.db.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: ctx.now() },
    });
    throw new AppError('REFRESH_TOKEN_REUSED', 'Sign in again.');
  }
  if (existing.expiresAt <= ctx.now()) {
    throw new AppError('UNAUTHENTICATED', 'Refresh token expired.');
  }

  const user = await loadUser(ctx.db, existing.userId);
  if (user.status !== 'ACTIVE') {
    await ctx.db.refreshToken.updateMany({
      where: { familyId: existing.familyId, revokedAt: null },
      data: { revokedAt: ctx.now() },
    });
    if (user.status === 'SUSPENDED') {
      throw new AppError('ACCOUNT_SUSPENDED', 'This account is suspended.');
    }
    throw new AppError('UNAUTHENTICATED', 'Sign in required.');
  }

  const ttl = audience === 'admin' ? ctx.env.ADMIN_REFRESH_TTL_SECONDS : ctx.env.REFRESH_TTL_SECONDS;
  const next = randomToken();
  const created = await ctx.db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashSecret(ctx.env.JWT_SECRET, next),
      familyId: existing.familyId,
      audience,
      expiresAt: new Date(ctx.now().getTime() + ttl * 1000),
    },
  });
  await ctx.db.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: ctx.now(), replacedById: created.id },
  });

  const { token, expiresIn } = await signAccessToken(ctx.env, {
    sub: user.id,
    role: user.role,
    scope: audience,
  });
  const cookieName = audience === 'admin' ? ADMIN_REFRESH_COOKIE : REFRESH_COOKIE;
  res.cookie(cookieName, next, cookieOpts(ctx.env, ttl));
  return {
    accessToken: token,
    refreshToken: isMobileClient(client) ? next : undefined,
    expiresIn,
    user: toAuthUser(user),
  };
}

export async function revokePresented(
  ctx: AuthContext,
  presented: string | undefined,
  audience: 'app' | 'admin',
  res: Response,
) {
  if (presented) {
    const tokenHash = hashSecret(ctx.env.JWT_SECRET, presented);
    await ctx.db.refreshToken.updateMany({
      where: { tokenHash, audience, revokedAt: null },
      data: { revokedAt: ctx.now() },
    });
  }
  const cookieName = audience === 'admin' ? ADMIN_REFRESH_COOKIE : REFRESH_COOKIE;
  res.clearCookie(cookieName, { path: '/' });
}

export async function revokeAll(ctx: AuthContext, userId: string) {
  await ctx.db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: ctx.now() },
  });
}

async function issueEmailCode(ctx: AuthContext, userId: string, email: string, purpose: 'EMAIL_VERIFY' | 'EMAIL_CHANGE' | 'PASSWORD_RESET') {
  const code = sixDigitCode();
  const ttlMin = purpose === 'PASSWORD_RESET' ? 30 : 60;
  await ctx.db.verificationCode.create({
    data: {
      userId,
      purpose,
      target: email,
      codeHash: hashSecret(ctx.env.JWT_SECRET, `${userId}:${purpose}:${code}`),
      expiresAt: new Date(ctx.now().getTime() + ttlMin * 60 * 1000),
    },
  });
  const message = otpEmail(purpose, code, ttlMin);
  await ctx.mailer.send({
    to: email,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
  return code;
}

export async function register(
  ctx: AuthContext,
  input: { email: string; password: string; displayName: string },
  res: Response,
  client: ClientKind,
) {
  const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
  if (existing && existing.status !== 'DELETED') {
    throw new AppError('EMAIL_TAKEN', 'An account with this email already exists.');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await ctx.db.user.create({
    data: {
      email: input.email,
      passwordHash,
      emailVerifiedAt: ctx.env.AUTH_SKIP_EMAIL_VERIFY ? ctx.now() : null,
      profile: { create: { displayName: input.displayName } },
    },
    include: { profile: true, identities: true },
  });
  if (!ctx.env.AUTH_SKIP_EMAIL_VERIFY) {
    await issueEmailCode(ctx, user.id, user.email, 'EMAIL_VERIFY');
  }
  return issueSession(ctx, user, res, client, 'app');
}

export async function login(
  ctx: AuthContext,
  input: { email: string; password: string },
  res: Response,
  client: ClientKind,
) {
  const user = await ctx.db.user.findUnique({
    where: { email: input.email },
    include: { profile: true, identities: true },
  });
  if (!user?.passwordHash || user.status === 'DELETED') {
    throw new AppError('UNAUTHENTICATED', 'Invalid email or password.');
  }
  if (user.status === 'SUSPENDED') {
    throw new AppError('ACCOUNT_SUSPENDED', 'This account is suspended.');
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new AppError('UNAUTHENTICATED', 'Invalid email or password.');
  if (!user.emailVerifiedAt && !ctx.env.AUTH_SKIP_EMAIL_VERIFY) {
    try {
      await resendVerification(ctx, user.id);
    } catch (err) {
      if (!(err instanceof AppError && err.code === 'RATE_LIMITED')) throw err;
    }
  }
  return issueSession(ctx, user, res, client, 'app');
}

export async function clerkSignIn(
  ctx: AuthContext,
  sessionToken: string,
  res: Response,
  client: ClientKind,
) {
  if (!ctx.clerk) throw new AppError('SERVICE_UNAVAILABLE', 'Clerk is not configured.');
  const profile = await ctx.clerk.profileFromSession(sessionToken);
  return socialSignIn(ctx, profile, res, client);
}

export async function socialSignIn(
  ctx: AuthContext,
  profile: SocialProfile,
  res: Response,
  client: ClientKind,
  displayNameHint?: string,
) {
  const existingIdentity = await ctx.db.authIdentity.findUnique({
    where: {
      provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId },
    },
  });
  if (existingIdentity) {
    const user = await loadUser(ctx.db, existingIdentity.userId);
    return issueSession(ctx, user, res, client, 'app');
  }

  if (profile.email) {
    const byEmail = await ctx.db.user.findUnique({
      where: { email: profile.email },
      include: { profile: true, identities: true },
    });
    if (byEmail && byEmail.status !== 'DELETED') {
      if (byEmail.emailVerifiedAt && profile.emailVerified) {
        await ctx.db.authIdentity.create({
          data: {
            userId: byEmail.id,
            provider: profile.provider,
            providerUserId: profile.providerUserId,
            email: profile.email,
          },
        });
        const linked = await loadUser(ctx.db, byEmail.id);
        return issueSession(ctx, linked, res, client, 'app');
      }
      throw new AppError('EMAIL_TAKEN', 'Sign in with your existing method, then link this provider.');
    }
  }

  const email = profile.email ?? `${profile.provider.toLowerCase()}-${profile.providerUserId}@users.playaround.invalid`;
  const displayName = displayNameHint ?? profile.displayName ?? 'Player';
  const user = await ctx.db.user.create({
    data: {
      email,
      emailVerifiedAt: profile.emailVerified && profile.email ? ctx.now() : null,
      identities: {
        create: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
        },
      },
      profile: { create: { displayName: displayName.slice(0, 60) } },
    },
    include: { profile: true, identities: true },
  });
  return issueSession(ctx, user, res, client, 'app');
}

export async function verifyEmail(ctx: AuthContext, userId: string, code: string) {
  const purposes = ['EMAIL_VERIFY', 'EMAIL_CHANGE'] as const;
  for (const purpose of purposes) {
    const row = await latestCode(ctx, userId, purpose);
    if (!row) continue;
    await consumeCode(ctx, row, `${userId}:${purpose}:${code}`, 5);
    if (purpose === 'EMAIL_CHANGE' && row.target) {
      await ctx.db.user.update({
        where: { id: userId },
        data: { email: row.target, emailVerifiedAt: ctx.now() },
      });
    } else {
      await ctx.db.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: ctx.now() },
      });
    }
    return;
  }
  throw new AppError('VALIDATION_ERROR', 'Invalid or expired code.');
}

export async function resendVerification(ctx: AuthContext, userId: string) {
  const user = await loadUser(ctx.db, userId);
  if (user.emailVerifiedAt) return;
  const recent = await ctx.db.verificationCode.count({
    where: {
      userId,
      purpose: 'EMAIL_VERIFY',
      createdAt: { gt: new Date(ctx.now().getTime() - 60 * 60 * 1000) },
    },
  });
  if (recent >= 3) throw new AppError('RATE_LIMITED', 'Try again in an hour.');
  await issueEmailCode(ctx, user.id, user.email, 'EMAIL_VERIFY');
}

export async function forgotPassword(ctx: AuthContext, email: string) {
  const user = await ctx.db.user.findUnique({ where: { email } });
  if (!user || user.status === 'DELETED' || !user.passwordHash) return;
  const recent = await ctx.db.verificationCode.count({
    where: {
      userId: user.id,
      purpose: 'PASSWORD_RESET',
      createdAt: { gt: new Date(ctx.now().getTime() - 60 * 60 * 1000) },
    },
  });
  if (recent >= 3) return;
  await issueEmailCode(ctx, user.id, user.email, 'PASSWORD_RESET');
}

export async function resetPassword(ctx: AuthContext, input: { email: string; code: string; password: string }) {
  const user = await ctx.db.user.findUnique({ where: { email: input.email } });
  if (!user) throw new AppError('VALIDATION_ERROR', 'Invalid or expired code.');
  const row = await latestCode(ctx, user.id, 'PASSWORD_RESET');
  if (!row) throw new AppError('VALIDATION_ERROR', 'Invalid or expired code.');
  await consumeCode(ctx, row, `${user.id}:PASSWORD_RESET:${input.code}`, 5);
  await ctx.db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.password) },
  });
  await revokeAll(ctx, user.id);
}

export async function listIdentities(ctx: AuthContext, userId: string) {
  const rows = await ctx.db.authIdentity.findMany({ where: { userId } });
  return rows.map((row) => ({
    provider: row.provider,
    email: row.email,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function linkIdentity(ctx: AuthContext, userId: string, profile: SocialProfile) {
  const taken = await ctx.db.authIdentity.findUnique({
    where: {
      provider_providerUserId: { provider: profile.provider, providerUserId: profile.providerUserId },
    },
  });
  if (taken) {
    if (taken.userId === userId) return listIdentities(ctx, userId);
    throw new AppError('IDENTITY_ALREADY_LINKED', 'This identity is already linked to another account.');
  }
  await ctx.db.authIdentity.create({
    data: {
      userId,
      provider: profile.provider,
      providerUserId: profile.providerUserId,
      email: profile.email,
    },
  });
  return listIdentities(ctx, userId);
}

export async function unlinkIdentity(ctx: AuthContext, userId: string, provider: 'GOOGLE' | 'APPLE') {
  const user = await loadUser(ctx.db, userId);
  const remaining = user.identities.filter((identity) => identity.provider !== provider);
  if (!user.passwordHash && remaining.length === 0) {
    throw new AppError('INVALID_STATE_TRANSITION', 'Cannot unlink the last sign-in method.');
  }
  await ctx.db.authIdentity.deleteMany({ where: { userId, provider } });
}

async function latestCode(
  ctx: AuthContext,
  userId: string,
  purpose: 'EMAIL_VERIFY' | 'EMAIL_CHANGE' | 'PASSWORD_RESET' | 'PHONE_VERIFY',
) {
  return ctx.db.verificationCode.findFirst({
    where: { userId, purpose, consumedAt: null, expiresAt: { gt: ctx.now() } },
    orderBy: { createdAt: 'desc' },
  });
}

async function consumeCode(
  ctx: AuthContext,
  row: { id: string; attempts: number; codeHash: string },
  material: string,
  maxAttempts: number,
) {
  if (row.attempts >= maxAttempts) {
    throw new AppError('VALIDATION_ERROR', 'Too many attempts. Request a new code.');
  }
  const match = row.codeHash === hashSecret(ctx.env.JWT_SECRET, material);
  if (!match) {
    await ctx.db.verificationCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    throw new AppError('VALIDATION_ERROR', 'Invalid or expired code.');
  }
  await ctx.db.verificationCode.update({
    where: { id: row.id },
    data: { consumedAt: ctx.now() },
  });
}

export async function requestEmailChange(ctx: AuthContext, userId: string, password: string, email: string) {
  const user = await loadUser(ctx.db, userId);
  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, password))) {
    throw new AppError('UNAUTHENTICATED', 'Invalid password.');
  }
  const taken = await ctx.db.user.findUnique({ where: { email } });
  if (taken && taken.id !== userId) throw new AppError('EMAIL_TAKEN', 'That email is already in use.');
  await issueEmailCode(ctx, userId, email, 'EMAIL_CHANGE');
}

export { STAFF_ROLES };
