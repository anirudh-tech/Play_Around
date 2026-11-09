import { ClientKind } from '@playaround/contracts';
import type { RequestHandler } from 'express';

export const parseClient: RequestHandler = (req, res, next) => {
  const raw = req.headers['x-client'];
  const parsed = typeof raw === 'string' ? ClientKind.safeParse(raw) : undefined;
  res.locals.client = parsed?.success ? parsed.data : 'web';
  next();
};

export function isMobileClient(client: string | undefined): boolean {
  return client === 'ios' || client === 'android';
}

export const REFRESH_COOKIE = 'playaround_refresh';
export const ADMIN_REFRESH_COOKIE = 'playaround_admin_refresh';
