import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io as clientIo, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { attachRealtime } from '../src/lib/realtime';
import { runReminderJob } from '../src/modules/notifications/reminder.job';
import { codeFrom, createTestApp, pingTestDb, resetDb } from './helpers';

const dbUp = await pingTestDb();

function once(socket: Socket, event: string, timeoutMs = 1000) {
  return new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe.skipIf(!dbUp)('realtime', () => {
  const ctx = createTestApp();
  const { app, db, env, mailer, push } = ctx;
  const logger = pino({ level: 'silent' });
  let server: Server;
  let base = '';
  let sportId = 0;
  let venueId = '';

  beforeAll(async () => {
    await resetDb(db);
    server = createServer(app);
    attachRealtime(server, { env, db, logger, push });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(async () => {
    mailer.outbox.length = 0;
    await resetDb(db);
    const sport = await db.sport.upsert({
      where: { slug: 'badminton' },
      update: { minPlayers: 2, maxPlayers: 50, isActive: true },
      create: {
        slug: 'badminton',
        name: 'Badminton',
        iconKey: 'badminton',
        accentColor: '#14B8A6',
        minPlayers: 2,
        maxPlayers: 50,
        defaultPlayers: 4,
      },
    });
    sportId = sport.id;
    const venue = await db.venue.create({
      data: {
        googlePlaceId: `rt-${randomUUID()}`,
        name: 'RT Court',
        addressLine: '1 Test St',
        area: 'Marina',
        city: 'Dubai',
        latitude: 25.08,
        longitude: 55.14,
      },
    });
    venueId = venue.id;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
  });

  async function member(email: string) {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client', 'ios')
      .send({ email, password: 'correcthorsebattery', displayName: email.split('@')[0] })
      .expect(201);
    const accessToken = res.body.data.accessToken as string;
    const userId = res.body.data.user.id as string;
    const code = codeFrom(mailer.outbox.at(-1)!.text);
    await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code })
      .expect(204);
    await db.user.update({
      where: { id: userId },
      data: { phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`, phoneVerifiedAt: new Date() },
    });
    return { accessToken, userId };
  }

  it('emits join events to another subscribed socket within 1s and persists notifications', async () => {
    const org = await member(`org-${randomUUID()}@example.com`);
    const player = await member(`player-${randomUUID()}@example.com`);
    const watcher = await member(`watch-${randomUUID()}@example.com`);
    const startsAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
    const created = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'EXISTING_BOOKING',
        sportId,
        venue: { venueId },
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
        capacity: 4,
        totalCostFils: 10000,
        title: 'Realtime game',
      })
      .expect(201);
    const sessionId = created.body.data.id as string;

    const socket = clientIo(base, {
      auth: { token: watcher.accessToken },
      transports: ['websocket'],
    });
    await once(socket, 'connect');
    socket.emit('session:subscribe', { ids: [sessionId] });
    const joined = once(socket, 'session:participant_joined');
    const availability = once(socket, 'session:availability');

    await request(app)
      .post(`/api/v1/sessions/${sessionId}/join`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);

    const joinPayload = (await joined) as { userId: string; sessionId: string };
    expect(joinPayload.userId).toBe(player.userId);
    const spots = (await availability) as { confirmedCount: number; version: number };
    expect(spots.confirmedCount).toBeGreaterThanOrEqual(1);
    expect(spots.version).toBeGreaterThan(0);

    const notes = await db.notification.findMany({ where: { userId: org.userId, type: 'PLAYER_JOINED' } });
    expect(notes.length).toBeGreaterThanOrEqual(1);
    socket.close();
  });

  it('sends session reminders for sessions starting in 24 hours', async () => {
    const org = await member(`org-rem-${randomUUID()}@example.com`);
    const startsAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'EXISTING_BOOKING',
        sportId,
        venue: { venueId },
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
        capacity: 4,
        totalCostFils: 10000,
        title: 'Reminder game',
        organiserIsPlaying: true,
      })
      .expect(201);
    const count = await runReminderJob(db, new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    const reminder = await db.notification.findFirst({
      where: { userId: org.userId, sessionId: created.body.data.id, type: 'SESSION_REMINDER' },
    });
    expect(reminder).toBeTruthy();
  });
});
