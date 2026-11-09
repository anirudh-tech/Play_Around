import { AdminLoginBody, AdminMfaBody, AdminRecoverBody, RefreshBody } from '@playaround/contracts';
import { Router } from 'express';
import type { Env } from '../../config/env';
import type { Mailer } from '../../lib/mailer';
import type { OauthVerifier } from '../../lib/oauth';
import type { Database } from '../../lib/prisma';
import { createRequireAuth, requireAdminScope, requireStaff } from '../../middleware/auth';
import { ADMIN_REFRESH_COOKIE } from '../../middleware/client';
import { createAdminLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import { rotateRefresh } from '../auth/auth.service';
import * as adminAuth from './admin-auth.service';

export interface AdminAuthRouteDeps {
  env: Env;
  db: Database;
  mailer: Mailer;
  oauth: OauthVerifier;
  now?: () => Date;
}

export function createAdminAuthRouter(deps: AdminAuthRouteDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.env, deps.db);
  const burst = createAdminLimiter(deps.env);
  const ctx = () => ({
    db: deps.db,
    env: deps.env,
    mailer: deps.mailer,
    oauth: deps.oauth,
    now: deps.now ?? (() => new Date()),
  });

  router.post('/auth/login', burst, validate({ body: AdminLoginBody }), async (_req, res) => {
    const body = res.locals.validated!.body as AdminLoginBody;
    await adminAuth.adminLogin(ctx(), body);
  });

  router.post('/auth/mfa/enrol', burst, validate({ body: AdminMfaBody }), async (_req, res) => {
    const body = res.locals.validated!.body as AdminMfaBody;
    const data = await adminAuth.enrolTotp(ctx(), body.mfaToken, body.code);
    res.json({ data });
  });

  router.post('/auth/mfa/verify', burst, validate({ body: AdminMfaBody }), async (_req, res) => {
    const body = res.locals.validated!.body as AdminMfaBody;
    const data = await adminAuth.verifyStaffMfa(
      ctx(),
      body.mfaToken,
      body.code,
      res,
      res.locals.client ?? 'admin',
    );
    res.json({ data });
  });

  router.post('/auth/mfa/recover', burst, validate({ body: AdminRecoverBody }), async (_req, res) => {
    const body = res.locals.validated!.body as AdminRecoverBody;
    const data = await adminAuth.recoverStaffMfa(
      ctx(),
      body.mfaToken,
      body.recoveryCode,
      res,
      res.locals.client ?? 'admin',
    );
    res.json({ data });
  });

  router.post('/auth/refresh', validate({ body: RefreshBody }), async (req, res) => {
    const presented = req.body?.refreshToken ?? req.cookies?.[ADMIN_REFRESH_COOKIE];
    const data = await rotateRefresh(ctx(), presented, res, res.locals.client ?? 'admin', 'admin');
    res.json({ data });
  });

  router.post('/auth/logout', requireAuth, requireStaff, requireAdminScope, async (req, res) => {
    await adminAuth.adminLogout(ctx(), req.body?.refreshToken ?? req.cookies?.[ADMIN_REFRESH_COOKIE], res);
    res.status(204).send();
  });

  return router;
}
