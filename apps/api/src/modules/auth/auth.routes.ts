import {
  AppleAuthBody,
  ClerkAuthBody,
  ForgotPasswordBody,
  GoogleAuthBody,
  IdentityProviderParams,
  LinkIdentityBody,
  LoginBody,
  RefreshBody,
  RegisterBody,
  ResetPasswordBody,
  VerifyEmailBody,
} from '@playaround/contracts';
import { Router } from 'express';
import type { Env } from '../../config/env';
import type { Mailer } from '../../lib/mailer';
import type { ClerkVerifier } from '../../lib/clerk';
import type { OauthVerifier } from '../../lib/oauth';
import type { Database } from '../../lib/prisma';
import { createRequireAuth } from '../../middleware/auth';
import { ADMIN_REFRESH_COOKIE, REFRESH_COOKIE } from '../../middleware/client';
import { createAuthLimiter, createHourlyLimiter } from '../../middleware/rate-limit';
import { validate } from '../../middleware/validate';
import * as auth from './auth.service';

export interface AuthRouteDeps {
  env: Env;
  db: Database;
  mailer: Mailer;
  oauth: OauthVerifier;
  clerk?: ClerkVerifier;
  now?: () => Date;
}

function ctx(deps: AuthRouteDeps): auth.AuthContext {
  return {
    db: deps.db,
    env: deps.env,
    mailer: deps.mailer,
    oauth: deps.oauth,
    clerk: deps.clerk,
    now: deps.now ?? (() => new Date()),
  };
}

function presentedRefresh(req: { cookies?: Record<string, string>; body?: { refreshToken?: string } }, admin = false) {
  return req.body?.refreshToken ?? req.cookies?.[admin ? ADMIN_REFRESH_COOKIE : REFRESH_COOKIE];
}

export function createAuthRouter(deps: AuthRouteDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.env, deps.db);
  const burst = createAuthLimiter(deps.env);
  const hourly = createHourlyLimiter(deps.env, 3);
  const c = () => ctx(deps);

  router.post('/auth/register', burst, validate({ body: RegisterBody }), async (req, res) => {
    const body = res.locals.validated!.body as RegisterBody;
    const data = await auth.register(c(), body, res, res.locals.client ?? 'web');
    res.status(201).json({ data });
  });

  router.post('/auth/login', burst, validate({ body: LoginBody }), async (req, res) => {
    const body = res.locals.validated!.body as LoginBody;
    const data = await auth.login(c(), body, res, res.locals.client ?? 'web');
    res.json({ data });
  });

  router.post('/auth/clerk', burst, validate({ body: ClerkAuthBody }), async (req, res) => {
    const body = res.locals.validated!.body as ClerkAuthBody;
    const data = await auth.clerkSignIn(c(), body.sessionToken, res, res.locals.client ?? 'web');
    res.json({ data });
  });

  router.post('/auth/google', burst, validate({ body: GoogleAuthBody }), async (req, res) => {
    const body = res.locals.validated!.body as GoogleAuthBody;
    const profile = await deps.oauth.google(body.idToken);
    const data = await auth.socialSignIn(c(), profile, res, res.locals.client ?? 'web');
    res.json({ data });
  });

  router.post('/auth/apple', burst, validate({ body: AppleAuthBody }), async (req, res) => {
    const body = res.locals.validated!.body as AppleAuthBody;
    const profile = await deps.oauth.apple(body.identityToken);
    const data = await auth.socialSignIn(c(), profile, res, res.locals.client ?? 'web', body.fullName);
    res.json({ data });
  });

  router.post('/auth/refresh', validate({ body: RefreshBody }), async (req, res) => {
    const data = await auth.rotateRefresh(
      c(),
      presentedRefresh(req),
      res,
      res.locals.client ?? 'web',
      'app',
    );
    res.json({ data });
  });

  router.post('/auth/logout', requireAuth, validate({ body: RefreshBody }), async (req, res) => {
    await auth.revokePresented(c(), presentedRefresh(req), 'app', res);
    res.status(204).send();
  });

  router.post('/auth/logout-all', requireAuth, async (_req, res) => {
    await auth.revokeAll(c(), res.locals.auth!.id);
    await auth.revokePresented(c(), undefined, 'app', res);
    res.status(204).send();
  });

  router.post('/auth/verify-email', requireAuth, validate({ body: VerifyEmailBody }), async (_req, res) => {
    const body = res.locals.validated!.body as VerifyEmailBody;
    await auth.verifyEmail(c(), res.locals.auth!.id, body.code);
    res.status(204).send();
  });

  router.post('/auth/verify-email/resend', requireAuth, hourly, async (_req, res) => {
    await auth.resendVerification(c(), res.locals.auth!.id);
    res.status(202).json({ data: { sent: true } });
  });

  router.post('/auth/forgot-password', hourly, validate({ body: ForgotPasswordBody }), async (_req, res) => {
    const body = res.locals.validated!.body as ForgotPasswordBody;
    await auth.forgotPassword(c(), body.email);
    res.status(202).json({ data: { sent: true } });
  });

  router.post('/auth/reset-password', hourly, validate({ body: ResetPasswordBody }), async (_req, res) => {
    const body = res.locals.validated!.body as ResetPasswordBody;
    await auth.resetPassword(c(), body);
    res.status(204).send();
  });

  router.get('/auth/identities', requireAuth, async (_req, res) => {
    const data = await auth.listIdentities(c(), res.locals.auth!.id);
    res.json({ data });
  });

  router.post('/auth/identities', requireAuth, validate({ body: LinkIdentityBody }), async (_req, res) => {
    const body = res.locals.validated!.body as LinkIdentityBody;
    const profile =
      body.provider === 'GOOGLE'
        ? await deps.oauth.google(body.idToken)
        : await deps.oauth.apple(body.identityToken);
    const data = await auth.linkIdentity(c(), res.locals.auth!.id, profile);
    res.json({ data });
  });

  router.delete(
    '/auth/identities/:provider',
    requireAuth,
    validate({ params: IdentityProviderParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { provider: 'GOOGLE' | 'APPLE' };
      await auth.unlinkIdentity(c(), res.locals.auth!.id, params.provider);
      res.status(204).send();
    },
  );

  return router;
}
