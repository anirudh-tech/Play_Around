import { TOTP, Secret } from 'otpauth';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { hashPassword } from '../src/lib/password';
import {
  appleProfiles,
  codeFrom,
  createTestApp,
  googleProfiles,
  pingTestDb,
  resetDb,
} from './helpers';

const dbUp = await pingTestDb();

describe.skipIf(!dbUp)('auth', () => {
  const ctx = createTestApp();
  const { app, db, mailer, sms } = ctx;

  beforeAll(async () => {
    await resetDb(db);
    await db.sport.upsert({
      where: { slug: 'badminton' },
      update: {},
      create: {
        slug: 'badminton',
        name: 'Badminton',
        iconKey: 'badminton',
        accentColor: '#00AA88',
        minPlayers: 2,
        maxPlayers: 8,
        defaultPlayers: 4,
      },
    });
  });

  beforeEach(async () => {
    mailer.outbox.length = 0;
    sms.outbox.length = 0;
    googleProfiles.clear();
    appleProfiles.clear();
    await resetDb(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function register(email = 'player@example.com') {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client', 'ios')
      .send({ email, password: 'correcthorsebattery', displayName: 'Asha' })
      .expect(201);
    return res.body.data as { accessToken: string; refreshToken: string; user: { id: string } };
  }

  it('registers, emails a code, and verifies email', async () => {
    const session = await register();
    expect(session.refreshToken).toBeTruthy();
    expect(mailer.outbox).toHaveLength(1);
    const code = codeFrom(mailer.outbox[0]!.text);
    await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ code })
      .expect(204);
    const me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(200);
    expect(me.body.data.emailVerifiedAt).toBeTruthy();
  });

  it('rejects a common password and a duplicate email', async () => {
    await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'a@example.com', password: 'password123', displayName: 'A' })
      .expect(400);
    await register('dupe@example.com');
    const again = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'dupe@example.com', password: 'correcthorsebattery', displayName: 'B' })
      .expect(409);
    expect(again.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('logs in and rotates refresh tokens, then detects reuse', async () => {
    await register('rotate@example.com');
    const mailed = mailer.outbox.length;
    const login = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client', 'ios')
      .send({ email: 'rotate@example.com', password: 'correcthorsebattery' })
      .expect(200);
    expect(mailer.outbox.length).toBe(mailed + 1);
    const first = login.body.data.refreshToken as string;
    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client', 'ios')
      .send({ refreshToken: first })
      .expect(200);
    const second = rotated.body.data.refreshToken as string;
    expect(second).not.toBe(first);
    const reuse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client', 'ios')
      .send({ refreshToken: first })
      .expect(401);
    expect(reuse.body.error.code).toBe('REFRESH_TOKEN_REUSED');
    const dead = await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client', 'ios')
      .send({ refreshToken: second })
      .expect(401);
    expect(['UNAUTHENTICATED', 'REFRESH_TOKEN_REUSED']).toContain(dead.body.error.code);
  });

  it('rejects an expired refresh token', async () => {
    const session = await register('expired@example.com');
    await db.refreshToken.updateMany({
      where: { userId: session.user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client', 'ios')
      .send({ refreshToken: session.refreshToken })
      .expect(401);
  });

  it('blocks a suspended account', async () => {
    const session = await register('suspended@example.com');
    await db.user.update({ where: { id: session.user.id }, data: { status: 'SUSPENDED' } });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'suspended@example.com', password: 'correcthorsebattery' })
      .expect(403);
    expect(login.body.error.code).toBe('ACCOUNT_SUSPENDED');
    const me = await request(app)
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .expect(403);
    expect(me.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('always returns 202 for forgot-password and resets with a code', async () => {
    await register('reset@example.com');
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.com' })
      .expect(202);
    await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'reset@example.com' })
      .expect(202);
    const code = codeFrom(mailer.outbox.at(-1)!.text);
    await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ email: 'reset@example.com', code, password: 'newhorsebattery1' })
      .expect(204);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'reset@example.com', password: 'newhorsebattery1' })
      .expect(200);
  });

  it('auto-links a verified Google email and refuses an unverified one', async () => {
    const session = await register('link@example.com');
    const code = codeFrom(mailer.outbox[0]!.text);
    await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ code })
      .expect(204);

    googleProfiles.set('g-verified', {
      provider: 'GOOGLE',
      providerUserId: 'gid-1',
      email: 'link@example.com',
      emailVerified: true,
      displayName: 'Asha',
    });
    const linked = await request(app)
      .post('/api/v1/auth/google')
      .set('X-Client', 'ios')
      .send({ idToken: 'g-verified' })
      .expect(200);
    expect(linked.body.data.user.id).toBe(session.user.id);

    await register('unverified@example.com');
    googleProfiles.set('g-unverified', {
      provider: 'GOOGLE',
      providerUserId: 'gid-2',
      email: 'unverified@example.com',
      emailVerified: true,
      displayName: 'Bob',
    });
    const refused = await request(app)
      .post('/api/v1/auth/google')
      .send({ idToken: 'g-unverified' })
      .expect(409);
    expect(refused.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('creates a new user from Apple and can link later', async () => {
    appleProfiles.set('apple-1', {
      provider: 'APPLE',
      providerUserId: 'apple-sub',
      email: 'apple@example.com',
      emailVerified: true,
      displayName: null,
    });
    const created = await request(app)
      .post('/api/v1/auth/apple')
      .set('X-Client', 'ios')
      .send({ identityToken: 'apple-1', authorizationCode: 'auth', fullName: 'Sam Player' })
      .expect(200);
    expect(created.body.data.user.emailVerifiedAt).toBeTruthy();
    expect(created.body.data.user.profile.displayName).toBe('Sam Player');
  });

  it('limits phone OTP sends and attempts', async () => {
    const session = await register('phone@example.com');
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post('/api/v1/users/me/phone')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ phone: '+971501234567' })
        .expect(202);
    }
    const fourth = await request(app)
      .post('/api/v1/users/me/phone')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ phone: '+971501234567' })
      .expect(429);
    expect(fourth.body.error.code).toBe('RATE_LIMITED');

    mailer.outbox.length = 0;
    sms.outbox.length = 0;
    await db.verificationCode.deleteMany();
    await request(app)
      .post('/api/v1/users/me/phone')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ phone: '+971509999999' })
      .expect(202);
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/users/me/phone/verify')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .send({ code: '000000' })
        .expect(400);
    }
    const locked = await request(app)
      .post('/api/v1/users/me/phone/verify')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ code: '000000' })
      .expect(400);
    expect(locked.body.error.message).toMatch(/Too many attempts/);
  });

  it('updates profile, favourites, devices, then deletes the account', async () => {
    const session = await register('profile@example.com');
    const sport = await db.sport.findFirst();
    await request(app)
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ displayName: 'Asha K', bio: 'Plays badminton' })
      .expect(200);
    await request(app)
      .put('/api/v1/users/me/favourite-sports')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send([{ sportId: sport!.id, skillLevel: 'ADVANCED' }])
      .expect(200);
    await request(app)
      .post('/api/v1/users/me/devices')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ platform: 'IOS', pushToken: 'ExponentPushToken[test]' })
      .expect(204);
    await request(app)
      .delete('/api/v1/users/me')
      .set('Authorization', `Bearer ${session.accessToken}`)
      .send({ password: 'correcthorsebattery' })
      .expect(204);
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'profile@example.com', password: 'correcthorsebattery' })
      .expect(401);
  });

  it('logs out a single session and logout-all', async () => {
    const a = await register('out@example.com');
    const b = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Client', 'ios')
      .send({ email: 'out@example.com', password: 'correcthorsebattery' })
      .expect(200);
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .set('X-Client', 'ios')
      .send({ refreshToken: a.refreshToken })
      .expect(204);
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client', 'ios')
      .send({ refreshToken: a.refreshToken })
      .expect(401);
    await request(app)
      .post('/api/v1/auth/logout-all')
      .set('Authorization', `Bearer ${b.body.data.accessToken}`)
      .expect(204);
    await request(app)
      .post('/api/v1/auth/refresh')
      .set('X-Client', 'ios')
      .send({ refreshToken: b.body.data.refreshToken })
      .expect(401);
  });
});

describe.skipIf(!dbUp)('admin auth', () => {
  const ctx = createTestApp();
  const { app, db } = ctx;

  beforeAll(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(async () => {
    await resetDb(db);
    await db.user.create({
      data: {
        email: 'admin@playaround.local',
        passwordHash: await hashPassword('PlayAroundAdmin1'),
        role: 'SUPER_ADMIN',
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: 'Admin' } },
      },
    });
  });

  it('enrols TOTP, issues admin tokens, and locks after five failures', async () => {
    const first = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@playaround.local', password: 'PlayAroundAdmin1' })
      .expect(401);
    expect(first.body.error.code).toBe('MFA_REQUIRED');
    const secret = first.body.error.details.enrolment.secret as string;
    const mfaToken = first.body.error.details.mfaToken as string;
    const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: 30 });
    const enrol = await request(app)
      .post('/api/v1/admin/auth/mfa/enrol')
      .send({ mfaToken, code: totp.generate() })
      .expect(200);
    expect(enrol.body.data.recoveryCodes).toHaveLength(10);

    const again = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@playaround.local', password: 'PlayAroundAdmin1' })
      .expect(401);
    const verifyToken = again.body.error.details.mfaToken as string;
    const session = await request(app)
      .post('/api/v1/admin/auth/mfa/verify')
      .set('X-Client', 'admin')
      .send({ mfaToken: verifyToken, code: totp.generate() })
      .expect(200);
    expect(session.body.data.accessToken).toBeTruthy();

    const failLogin = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'admin@playaround.local', password: 'PlayAroundAdmin1' })
      .expect(401);
    const failToken = failLogin.body.error.details.mfaToken as string;
    for (let i = 0; i < 5; i += 1) {
      await request(app)
        .post('/api/v1/admin/auth/mfa/verify')
        .send({ mfaToken: failToken, code: '000000' })
        .expect(401);
    }
    const locked = await request(app)
      .post('/api/v1/admin/auth/mfa/verify')
      .send({ mfaToken: failToken, code: totp.generate() })
      .expect(401);
    expect(locked.body.error.code).toBe('MFA_INVALID');
    expect(locked.body.error.message).toMatch(/Try again later/);
  });

  it('rejects member credentials on the admin login', async () => {
    await db.user.create({
      data: {
        email: 'player@example.com',
        passwordHash: await hashPassword('correcthorsebattery'),
        role: 'USER',
        profile: { create: { displayName: 'P' } },
      },
    });
    const res = await request(app)
      .post('/api/v1/admin/auth/login')
      .send({ email: 'player@example.com', password: 'correcthorsebattery' })
      .expect(403);
    expect(res.body.error.code).toBe('STAFF_ROLE_REQUIRED');
  });
});

describe.skipIf(!dbUp)('auth clerk and skip email verify', () => {
  it('skips OTP when AUTH_SKIP_EMAIL_VERIFY is set', async () => {
    const { app, db, mailer } = createTestApp({ env: { AUTH_SKIP_EMAIL_VERIFY: 'true' } });
    await resetDb(db);
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client', 'ios')
      .send({ email: 'skip@example.com', password: 'correcthorsebattery', displayName: 'Skip' })
      .expect(201);
    expect(res.body.data.user.emailVerifiedAt).toBeTruthy();
    expect(mailer.outbox).toHaveLength(0);
    await db.$disconnect();
  });

  it('creates a PlayAround session from a Clerk Google profile', async () => {
    const { app, db } = createTestApp({
      clerk: {
        async profileFromSession(sessionToken) {
          if (sessionToken !== 'sess_ok') throw new Error('bad session');
          return {
            provider: 'GOOGLE',
            providerUserId: 'google-clerk-1',
            email: 'clerk-google@example.com',
            emailVerified: true,
            displayName: 'Clerk Google',
          };
        },
      },
    });
    await resetDb(db);
    const res = await request(app)
      .post('/api/v1/auth/clerk')
      .set('X-Client', 'web')
      .send({ sessionToken: 'sess_ok' })
      .expect(200);
    expect(res.body.data.user.email).toBe('clerk-google@example.com');
    expect(res.body.data.user.emailVerifiedAt).toBeTruthy();
    await db.$disconnect();
  });
});
