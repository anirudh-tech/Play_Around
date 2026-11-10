import { createServer } from 'node:http';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { createEventBus } from './lib/event-bus';
import { createJobRunner } from './lib/job-runner';
import { createLogger } from './lib/logger';
import { createSmtpMailer } from './lib/mailer';
import { createOauthVerifier } from './lib/oauth';
import { checkDatabase, createPrismaClient } from './lib/prisma';
import { createExpoPush } from './lib/push';
import { attachRealtime } from './lib/realtime';
import { createConsoleSms } from './lib/sms';
import { reminderJob } from './modules/notifications/reminder.job';
import { sessionJobs } from './modules/sessions/jobs';

const env = loadEnv();
const logger = createLogger(env);
const db = createPrismaClient(env.DATABASE_URL);
const events = createEventBus(logger);
const jobs = createJobRunner(logger);
const mailer = createSmtpMailer(env, logger);
const sms = createConsoleSms(logger);
const oauth = createOauthVerifier(env);

for (const job of sessionJobs(db)) jobs.register(job);
jobs.register(reminderJob(db));

const app = createApp({
  env,
  logger,
  db,
  mailer,
  sms,
  oauth,
  checkDatabase: () => checkDatabase(db, 8_000, (err) => logger.warn({ err }, 'database ping failed')),
});

const httpServer = createServer(app);
attachRealtime(httpServer, {
  env,
  db,
  logger,
  push: createExpoPush(env.EXPO_ACCESS_TOKEN),
});

httpServer.listen(env.PORT, () => {
  logger.info({ port: env.PORT, docs: `http://localhost:${env.PORT}/docs` }, 'api listening');
  if (env.JOBS_ENABLED) jobs.start();
  void events.publish('system.started', { at: new Date() });
  void checkDatabase(db).then((up) => {
    if (!up) logger.warn('database unreachable — /health/ready will report not_ready');
  });
});

let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');
  httpServer.close();
  await jobs.stop();
  await db.$disconnect().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
