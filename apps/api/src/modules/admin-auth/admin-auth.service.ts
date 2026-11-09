import { STAFF_ROLES } from '@playaround/contracts';
import type { Response } from 'express';
import { AppError } from '../../lib/errors';
import { verifyPassword } from '../../lib/password';
import {
  createRecoveryCodes,
  openTotpSecret,
  otpauthUri,
  remainingRecoveryHashes,
  sealTotpSecret,
  verifyTotp,
} from '../../lib/totp';
import { signMfaToken, verifyMfaToken } from '../../lib/tokens';
import { Secret } from 'otpauth';
import type { AuthContext } from '../auth/auth.service';
import { issueSession, revokeAll, revokePresented } from '../auth/auth.service';
import type { ClientKind } from '@playaround/contracts';

const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60 * 1000;

function isStaff(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

export async function adminLogin(ctx: AuthContext, input: { email: string; password: string }) {
  const user = await ctx.db.user.findUnique({
    where: { email: input.email },
    include: { mfa: true, profile: true, identities: true },
  });
  if (!user?.passwordHash || user.status === 'DELETED' || !isStaff(user.role)) {
    throw new AppError('STAFF_ROLE_REQUIRED', 'Staff credentials required.');
  }
  if (user.status === 'SUSPENDED') {
    throw new AppError('ACCOUNT_SUSPENDED', 'This account is suspended.');
  }
  const ok = await verifyPassword(user.passwordHash, input.password);
  if (!ok) throw new AppError('UNAUTHENTICATED', 'Invalid email or password.');

  if (user.mfa?.lockedUntil && user.mfa.lockedUntil > ctx.now()) {
    throw new AppError('MFA_INVALID', 'Too many attempts. Try again later.');
  }

  if (!user.mfa || !user.mfa.enabledAt) {
    const secret = new Secret({ size: 20 }).base32;
    const sealed = sealTotpSecret(ctx.env.TOTP_ENCRYPTION_KEY, secret);
    await ctx.db.userMfa.upsert({
      where: { userId: user.id },
      create: { userId: user.id, totpSecretEnc: sealed, recoveryCodes: [] },
      update: { totpSecretEnc: sealed, enabledAt: null, recoveryCodes: [] },
    });
    const mfaToken = await signMfaToken(ctx.env, user.id, 'enrol');
    throw new AppError('MFA_REQUIRED', 'Enrol TOTP to continue.', {
      mfaToken,
      enrolment: { secret, otpauthUri: otpauthUri(user.email, secret) },
    });
  }

  const mfaToken = await signMfaToken(ctx.env, user.id, 'verify');
  throw new AppError('MFA_REQUIRED', 'Enter your authenticator code.', { mfaToken });
}

export async function enrolTotp(ctx: AuthContext, mfaToken: string, code: string) {
  const { userId, purpose } = await verifyMfaToken(ctx.env, mfaToken);
  if (purpose !== 'enrol') throw new AppError('UNAUTHENTICATED', 'Invalid MFA token.');
  const mfa = await ctx.db.userMfa.findUnique({ where: { userId } });
  if (!mfa) throw new AppError('MFA_INVALID', 'Start staff sign-in again.');
  const secret = openTotpSecret(ctx.env.TOTP_ENCRYPTION_KEY, mfa.totpSecretEnc);
  if (!verifyTotp(secret, code)) throw new AppError('MFA_INVALID', 'Invalid authenticator code.');
  const recovery = createRecoveryCodes();
  await ctx.db.userMfa.update({
    where: { userId },
    data: { enabledAt: ctx.now(), recoveryCodes: recovery.hashes, failedCount: 0, lockedUntil: null },
  });
  return { recoveryCodes: recovery.plain };
}

export async function verifyStaffMfa(
  ctx: AuthContext,
  mfaToken: string,
  code: string,
  res: Response,
  client: ClientKind,
) {
  const { userId } = await verifyMfaToken(ctx.env, mfaToken);
  const user = await ctx.db.user.findUnique({
    where: { id: userId },
    include: { mfa: true, profile: true, identities: true },
  });
  if (!user?.mfa?.enabledAt || !isStaff(user.role)) {
    throw new AppError('STAFF_ROLE_REQUIRED', 'Staff credentials required.');
  }
  if (user.mfa.lockedUntil && user.mfa.lockedUntil > ctx.now()) {
    throw new AppError('MFA_INVALID', 'Too many attempts. Try again later.');
  }
  const secret = openTotpSecret(ctx.env.TOTP_ENCRYPTION_KEY, user.mfa.totpSecretEnc);
  if (!verifyTotp(secret, code)) {
    const failed = user.mfa.failedCount + 1;
    const lockedUntil = failed >= LOCK_AFTER ? new Date(ctx.now().getTime() + LOCK_MS) : null;
    await ctx.db.userMfa.update({
      where: { userId },
      data: { failedCount: failed, lockedUntil },
    });
    if (lockedUntil) {
      await ctx.db.adminAuditLog.create({
        data: {
          actorId: userId,
          action: 'mfa.lockout',
          targetType: 'user',
          targetId: userId,
          reason: 'Five failed TOTP attempts',
        },
      });
    }
    throw new AppError('MFA_INVALID', 'Invalid authenticator code.');
  }
  await ctx.db.userMfa.update({
    where: { userId },
    data: { failedCount: 0, lockedUntil: null },
  });
  return issueSession(ctx, user, res, client, 'admin');
}

export async function recoverStaffMfa(
  ctx: AuthContext,
  mfaToken: string,
  recoveryCode: string,
  res: Response,
  client: ClientKind,
) {
  const { userId } = await verifyMfaToken(ctx.env, mfaToken);
  const user = await ctx.db.user.findUnique({
    where: { id: userId },
    include: { mfa: true, profile: true, identities: true },
  });
  if (!user?.mfa?.enabledAt) throw new AppError('MFA_INVALID', 'MFA is not enrolled.');
  const hashes = Array.isArray(user.mfa.recoveryCodes)
    ? (user.mfa.recoveryCodes as string[])
    : [];
  const remaining = remainingRecoveryHashes(hashes, recoveryCode);
  if (!remaining) throw new AppError('MFA_INVALID', 'Invalid recovery code.');
  await ctx.db.userMfa.update({
    where: { userId },
    data: { recoveryCodes: remaining, failedCount: 0, lockedUntil: null },
  });
  return issueSession(ctx, user, res, client, 'admin');
}

export async function adminLogout(ctx: AuthContext, token: string | undefined, res: Response) {
  await revokePresented(ctx, token, 'admin', res);
}

export async function adminLogoutAll(ctx: AuthContext, userId: string, res: Response) {
  await revokeAll(ctx, userId);
  await revokePresented(ctx, undefined, 'admin', res);
}
