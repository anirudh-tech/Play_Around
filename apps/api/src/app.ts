import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { Env } from './config/env';
import { createDocsRouter } from './docs/openapi';
import type { Logger } from './lib/logger';
import type { Mailer } from './lib/mailer';
import type { ClerkVerifier } from './lib/clerk';
import type { OauthVerifier } from './lib/oauth';
import type { Database } from './lib/prisma';
import type { SmsGateway } from './lib/sms';
import { createErrorHandler, notFoundHandler } from './middleware/error-handler';
import { parseClient } from './middleware/client';
import { createHealthRouter } from './modules/health/health.routes';
import { createAuthRouter } from './modules/auth/auth.routes';
import { createUsersRouter } from './modules/users/users.routes';
import { createAdminAuthRouter } from './modules/admin-auth/admin-auth.routes';
import { createSessionsRouter } from './modules/sessions/sessions.routes';
import { createNotificationsRouter } from './modules/notifications/notifications.routes';
import { createEngagementRouter } from './modules/engagement/engagement.routes';
import { createPaymentsRouter } from './modules/payments/payments.routes';
import { createAdminOpsRouter } from './modules/admin/admin.routes';

export interface AppDeps {
  env: Pick<Env, 'CORS_ORIGINS' | 'APP_VERSION'> & Partial<Env>;
  logger: Logger;
  checkDatabase: () => Promise<boolean>;
  db?: Database;
  mailer?: Mailer;
  sms?: SmsGateway;
  oauth?: OauthVerifier;
  clerk?: ClerkVerifier;
  now?: () => Date;
}

export function createApp(deps: AppDeps): Express {
  const { env, logger, checkDatabase } = deps;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req, res) => {
        const incoming = req.headers['x-request-id'];
        const id = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url?.startsWith('/api/v1/health') ?? false },
    }),
  );
  app.use(
    helmet({
      // Default CORP `same-origin` blocks the Vercel browser from reading API responses.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Client', 'X-App-Version', 'Idempotency-Key', 'X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(parseClient);

  const health = createHealthRouter({ version: env.APP_VERSION, checkDatabase });
  app.use(health);

  const v1 = express.Router();
  v1.use(health);

  if (deps.db && deps.mailer && deps.sms && deps.oauth) {
    const authEnv = env as Env;
    const shared = {
      env: authEnv,
      db: deps.db,
      mailer: deps.mailer,
      oauth: deps.oauth,
      clerk: deps.clerk,
      now: deps.now,
    };
    const clock = deps.now ?? (() => new Date());
    v1.use(createAuthRouter(shared));
    v1.use(createUsersRouter({ ...shared, sms: deps.sms }));
    v1.use('/admin', createAdminAuthRouter(shared));
    v1.use('/admin', createAdminOpsRouter(authEnv, deps.db, clock));
    v1.use(createSessionsRouter(authEnv, deps.db, clock));
    v1.use(createPaymentsRouter(authEnv, deps.db, clock));
    v1.use(createNotificationsRouter(authEnv, deps.db));
    v1.use(createEngagementRouter(authEnv, deps.db, clock));
  }

  app.use('/api/v1', v1);
  app.use('/docs', createDocsRouter(env.APP_VERSION));
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));
  return app;
}
