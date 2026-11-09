import {
  ChangeEmailBody,
  DeviceBody,
  FavouriteSportsBody,
  PatchMeBody,
  PhoneBody,
  Uuid,
  VerifyEmailBody,
} from '@playaround/contracts';
import { Router } from 'express';
import { z as zod } from 'zod';
import type { Env } from '../../config/env';
import type { Mailer } from '../../lib/mailer';
import type { OauthVerifier } from '../../lib/oauth';
import type { Database } from '../../lib/prisma';
import type { SmsGateway } from '../../lib/sms';
import { createRequireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { requestEmailChange } from '../auth/auth.service';
import * as users from './users.service';

export interface UserRouteDeps {
  env: Env;
  db: Database;
  mailer: Mailer;
  sms: SmsGateway;
  oauth: OauthVerifier;
  now?: () => Date;
}

const IdParams = zod.object({ id: Uuid });
const PushParams = zod.object({ pushToken: zod.string().min(1) });
const DeleteMeBody = zod.object({ password: zod.string().min(1).optional() });

export function createUsersRouter(deps: UserRouteDeps): Router {
  const router = Router();
  const requireAuth = createRequireAuth(deps.env, deps.db);
  const ctx = (): users.UserContext => ({
    db: deps.db,
    env: deps.env,
    mailer: deps.mailer,
    oauth: deps.oauth,
    sms: deps.sms,
    now: deps.now ?? (() => new Date()),
  });

  router.get('/users/me', requireAuth, async (_req, res) => {
    const data = await users.getMe(ctx(), res.locals.auth!.id);
    res.json({ data });
  });

  router.patch('/users/me', requireAuth, validate({ body: PatchMeBody }), async (_req, res) => {
    const body = res.locals.validated!.body as PatchMeBody;
    const data = await users.patchMe(ctx(), res.locals.auth!.id, body);
    res.json({ data });
  });

  router.post('/users/me/email', requireAuth, validate({ body: ChangeEmailBody }), async (_req, res) => {
    const body = res.locals.validated!.body as ChangeEmailBody;
    await requestEmailChange(ctx(), res.locals.auth!.id, body.password, body.email);
    res.status(202).json({ data: { sent: true } });
  });

  router.post('/users/me/phone', requireAuth, validate({ body: PhoneBody }), async (_req, res) => {
    const body = res.locals.validated!.body as PhoneBody;
    await users.requestPhoneCode(ctx(), res.locals.auth!.id, body.phone);
    res.status(202).json({ data: { sent: true } });
  });

  router.post('/users/me/phone/verify', requireAuth, validate({ body: VerifyEmailBody }), async (_req, res) => {
    const body = res.locals.validated!.body as VerifyEmailBody;
    await users.verifyPhone(ctx(), res.locals.auth!.id, body.code);
    res.status(204).send();
  });

  router.put(
    '/users/me/favourite-sports',
    requireAuth,
    validate({ body: FavouriteSportsBody }),
    async (_req, res) => {
      const body = res.locals.validated!.body as FavouriteSportsBody;
      const data = await users.setFavouriteSports(ctx(), res.locals.auth!.id, body);
      res.json({ data });
    },
  );

  router.post('/users/me/devices', requireAuth, validate({ body: DeviceBody }), async (_req, res) => {
    const body = res.locals.validated!.body as DeviceBody;
    await users.upsertDevice(ctx(), res.locals.auth!.id, body);
    res.status(204).send();
  });

  router.delete(
    '/users/me/devices/:pushToken',
    requireAuth,
    validate({ params: PushParams }),
    async (_req, res) => {
      const params = res.locals.validated!.params as { pushToken: string };
      await users.removeDevice(ctx(), res.locals.auth!.id, params.pushToken);
      res.status(204).send();
    },
  );

  router.delete('/users/me', requireAuth, validate({ body: DeleteMeBody }), async (_req, res) => {
    const body = (res.locals.validated?.body ?? {}) as { password?: string };
    await users.deleteAccount(ctx(), res.locals.auth!.id, body.password);
    res.status(204).send();
  });

  router.get('/users/:id', requireAuth, validate({ params: IdParams }), async (_req, res) => {
    const params = res.locals.validated!.params as { id: string };
    const data = await users.getPublicProfile(ctx(), params.id);
    res.json({ data });
  });

  router.get('/users/:id/reviews', requireAuth, validate({ params: IdParams }), async (_req, res) => {
    res.json({ data: [], meta: { nextCursor: null } });
  });

  return router;
}
