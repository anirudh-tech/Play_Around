import { pino } from 'pino';
import { createApp } from '../src/app';
import { loadEnv } from '../src/config/env';
import { createMemoryMailer } from '../src/lib/mailer';
import type { OauthVerifier, SocialProfile } from '../src/lib/oauth';
import { checkDatabase, createPrismaClient, type Database } from '../src/lib/prisma';
import { createMemoryPush } from '../src/lib/push';
import { configureRealtime } from '../src/lib/realtime';
import { createMemorySms } from '../src/lib/sms';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://playaround:playaround@127.0.0.1:5433/playaround_test';

const logger = pino({ level: 'silent' });

export const googleProfiles = new Map<string, SocialProfile>();
export const appleProfiles = new Map<string, SocialProfile>();

export const stubOauth: OauthVerifier = {
  async google(idToken) {
    const profile = googleProfiles.get(idToken);
    if (!profile) throw new Error('unknown google token');
    return profile;
  },
  async apple(identityToken) {
    const profile = appleProfiles.get(identityToken);
    if (!profile) throw new Error('unknown apple token');
    return profile;
  },
};

export async function pingTestDb(): Promise<boolean> {
  const db = createPrismaClient(TEST_DATABASE_URL);
  try {
    return await checkDatabase(db, 3_000);
  } finally {
    await db.$disconnect().catch(() => undefined);
  }
}

export async function resetDb(db: Database) {
  const tables = [
    'admin_audit_logs',
    'notifications',
    'reviews',
    'reports',
    'price_consents',
    'session_price_changes',
    'payment_confirmations',
    'payment_disputes',
    'payments',
    'venue_bookings',
    'venue_options',
    'venue_arrangements',
    'session_events',
    'session_images',
    'session_interests',
    'session_participants',
    'sessions',
    'idempotency_keys',
    'verification_codes',
    'refresh_tokens',
    'auth_identities',
    'user_mfa',
    'devices',
    'user_favourite_sports',
    'user_profiles',
    'users',
  ];
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
}

export function createTestApp() {
  const env = loadEnv({
    NODE_ENV: 'test',
    DATABASE_URL: TEST_DATABASE_URL,
    LOG_LEVEL: 'silent',
    RATE_LIMIT_DISABLED: 'true',
    COOKIE_SECURE: 'false',
  });
  const db = createPrismaClient(env.DATABASE_URL);
  const mailer = createMemoryMailer();
  const sms = createMemorySms();
  const push = createMemoryPush();
  configureRealtime({ env, db, logger, push });
  const app = createApp({
    env,
    logger,
    db,
    mailer,
    sms,
    oauth: stubOauth,
    checkDatabase: () => checkDatabase(db),
  });
  return { app, db, env, mailer, sms, push };
}

export function codeFrom(text: string): string {
  const match = text.match(/\b(\d{6})\b/);
  if (!match) throw new Error(`No OTP in ${text}`);
  return match[1]!;
}
