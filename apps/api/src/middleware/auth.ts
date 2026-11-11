import { STAFF_ROLES, type UserRole } from '@playaround/contracts';
import type { RequestHandler } from 'express';
import type { Env } from '../config/env';
import { AppError } from '../lib/errors';
import type { Database } from '../lib/prisma';
import { verifyAccessToken, type TokenScope } from '../lib/tokens';

export interface AuthedUser {
  id: string;
  email: string;
  role: UserRole;
  scope: TokenScope;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
}

export function createRequireVerifiedEmail(env: Pick<Env, 'AUTH_SKIP_EMAIL_VERIFY'>): RequestHandler {
  return (_req, res, next) => {
    if (env.AUTH_SKIP_EMAIL_VERIFY) {
      next();
      return;
    }
    const auth = res.locals.auth;
    if (!auth?.emailVerifiedAt) {
      next(new AppError('EMAIL_NOT_VERIFIED', 'Verify your email first.'));
      return;
    }
    next();
  };
}

export function createRequireAuth(env: Pick<Env, 'JWT_SECRET'>, db: Database): RequestHandler {
  return async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
      if (!token) throw new AppError('UNAUTHENTICATED', 'Sign in required.');
      const claims = await verifyAccessToken(env, token);
      const user = await db.user.findUnique({ where: { id: claims.sub } });
      if (!user || user.status === 'DELETED') throw new AppError('UNAUTHENTICATED', 'Sign in required.');
      if (user.status === 'SUSPENDED') {
        throw new AppError('ACCOUNT_SUSPENDED', 'This account is suspended.');
      }
      const auth: AuthedUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        scope: claims.scope,
        emailVerifiedAt: user.emailVerifiedAt,
        phoneVerifiedAt: user.phoneVerifiedAt,
        status: user.status,
      };
      res.locals.auth = auth;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const requireVerifiedEmail: RequestHandler = (_req, res, next) => {
  const auth = res.locals.auth;
  if (!auth?.emailVerifiedAt) {
    next(new AppError('EMAIL_NOT_VERIFIED', 'Verify your email first.'));
    return;
  }
  next();
};

export const requireVerifiedPhone: RequestHandler = (_req, res, next) => {
  const auth = res.locals.auth;
  if (!auth?.phoneVerifiedAt) {
    next(new AppError('PHONE_NOT_VERIFIED', 'Verify a phone number first.'));
    return;
  }
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (_req, res, next) => {
    const auth = res.locals.auth;
    if (!auth || !roles.includes(auth.role)) {
      next(new AppError('STAFF_ROLE_REQUIRED', 'You do not have access to this resource.'));
      return;
    }
    next();
  };
}

export const requireStaff = requireRole(...STAFF_ROLES);

export const requireAdminScope: RequestHandler = (_req, res, next) => {
  if (res.locals.auth?.scope !== 'admin') {
    next(new AppError('STAFF_ROLE_REQUIRED', 'Admin session required.'));
    return;
  }
  next();
};
