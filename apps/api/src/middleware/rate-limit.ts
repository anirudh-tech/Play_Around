import type { RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { rateLimitsEnabled, type Env } from '../config/env';
import { AppError } from '../lib/errors';

const skipValidation = { validate: false as const, standardHeaders: true, legacyHeaders: false };

function reject(): never {
  throw new AppError('RATE_LIMITED', 'Too many attempts. Try again later.');
}

export function createAuthLimiter(env: Pick<Env, 'NODE_ENV' | 'RATE_LIMIT_DISABLED'>): RequestHandler {
  if (!rateLimitsEnabled(env)) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    ...skipValidation,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
      return `${req.ip}:${email}`;
    },
    handler: reject,
  });
}

export function createHourlyLimiter(
  env: Pick<Env, 'NODE_ENV' | 'RATE_LIMIT_DISABLED'>,
  limit = 3,
): RequestHandler {
  if (!rateLimitsEnabled(env)) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    ...skipValidation,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : (req.ip ?? 'anon');
      return `${req.ip}:${email}`;
    },
    handler: reject,
  });
}

export function createNearbyLimiter(env: Pick<Env, 'NODE_ENV' | 'RATE_LIMIT_DISABLED'>): RequestHandler {
  if (!rateLimitsEnabled(env)) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    ...skipValidation,
    keyGenerator: (_req, res) => res.locals.auth?.id ?? _req.ip ?? 'anon',
    handler: reject,
  });
}

export function createAdminLimiter(env: Pick<Env, 'NODE_ENV' | 'RATE_LIMIT_DISABLED'>): RequestHandler {
  if (!rateLimitsEnabled(env)) return (_req, _res, next) => next();
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    ...skipValidation,
    keyGenerator: (req) => {
      const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
      return `admin:${req.ip}:${email}`;
    },
    handler: reject,
  });
}
