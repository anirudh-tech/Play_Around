import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { AppError } from './errors';
import type { Env } from '../config/env';
import type { UserRole } from '@playaround/contracts';

export type TokenScope = 'app' | 'admin' | 'mfa';

export interface AccessClaims {
  sub: string;
  role: UserRole;
  scope: TokenScope;
}

const encoder = new TextEncoder();

function secret(env: Pick<Env, 'JWT_SECRET'>): Uint8Array {
  return encoder.encode(env.JWT_SECRET);
}

export async function signAccessToken(
  env: Pick<Env, 'JWT_SECRET' | 'ACCESS_TTL_SECONDS' | 'ADMIN_ACCESS_TTL_SECONDS'>,
  claims: AccessClaims,
  ttlSeconds?: number,
): Promise<{ token: string; expiresIn: number }> {
  const expiresIn =
    ttlSeconds ?? (claims.scope === 'admin' ? env.ADMIN_ACCESS_TTL_SECONDS : env.ACCESS_TTL_SECONDS);
  const token = await new SignJWT({ role: claims.role, scope: claims.scope })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${expiresIn}s`)
    .sign(secret(env));
  return { token, expiresIn };
}

export async function signMfaToken(
  env: Pick<Env, 'JWT_SECRET'>,
  userId: string,
  purpose: 'enrol' | 'verify',
): Promise<string> {
  return new SignJWT({ scope: 'mfa', purpose })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret(env));
}

export async function verifyAccessToken(
  env: Pick<Env, 'JWT_SECRET'>,
  token: string,
): Promise<AccessClaims> {
  try {
    const { payload } = await jwtVerify(token, secret(env), { algorithms: ['HS256'] });
    const scope = payload.scope;
    if (payload.sub && (scope === 'app' || scope === 'admin') && typeof payload.role === 'string') {
      return { sub: payload.sub, role: payload.role as AccessClaims['role'], scope };
    }
    throw new AppError('UNAUTHENTICATED', 'Invalid access token.');
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof joseErrors.JWTExpired) {
      throw new AppError('TOKEN_EXPIRED', 'Access token expired.');
    }
    throw new AppError('UNAUTHENTICATED', 'Invalid access token.');
  }
}

export async function verifyMfaToken(
  env: Pick<Env, 'JWT_SECRET'>,
  token: string,
): Promise<{ userId: string; purpose: 'enrol' | 'verify' }> {
  try {
    const { payload } = await jwtVerify(token, secret(env), { algorithms: ['HS256'] });
    const purpose = payload.purpose;
    if (payload.sub && payload.scope === 'mfa' && (purpose === 'enrol' || purpose === 'verify')) {
      return { userId: payload.sub, purpose };
    }
    throw new AppError('UNAUTHENTICATED', 'Invalid MFA token.');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('UNAUTHENTICATED', 'Invalid MFA token.');
  }
}
