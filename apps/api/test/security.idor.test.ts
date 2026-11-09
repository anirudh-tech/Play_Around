import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { codeFrom, createTestApp, pingTestDb, resetDb } from './helpers';

const dbUp = await pingTestDb();

describe.skipIf(!dbUp)('IDOR on :id mutations', () => {
  const ctx = createTestApp();
  const { app, db, mailer } = ctx;
  let sportId = 0;
  let venueId = '';

  beforeAll(async () => {
    await resetDb(db);
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
        googlePlaceId: `test-${randomUUID()}`,
        name: 'Test Court',
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

  function startsIn(hours: number) {
    const startsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  }

  async function sessionWithPlayer() {
    const org = await member(`org-${randomUUID()}@example.com`);
    const player = await member(`player-${randomUUID()}@example.com`);
    const stranger = await member(`stranger-${randomUUID()}@example.com`);
    const created = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'EXISTING_BOOKING',
        sportId,
        venue: { venueId },
        ...startsIn(6),
        capacity: 4,
        totalCostFils: 10_000,
        organiserIsPlaying: false,
      })
      .expect(201);
    const sessionId = created.body.data.id as string;
    const joined = await request(app)
      .post(`/api/v1/sessions/${sessionId}/join`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    return { org, player, stranger, sessionId, paymentId: joined.body.data.payment.id as string };
  }

  it('stranger cannot patch, cancel, remove, refund or remind', async () => {
    const { player, stranger, sessionId, paymentId } = await sessionWithPlayer();
    const auth = { Authorization: `Bearer ${stranger.accessToken}` };

    const patched = await request(app)
      .patch(`/api/v1/sessions/${sessionId}`)
      .set(auth)
      .send({ title: 'hijack' })
      .expect(403);
    expect(patched.body.error.code).toMatch(/FORBIDDEN|NOT_ORGANISER/);

    const cancelled = await request(app)
      .post(`/api/v1/sessions/${sessionId}/cancel`)
      .set(auth)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(403);
    expect(cancelled.body.error.code).toMatch(/FORBIDDEN|NOT_ORGANISER/);

    const removed = await request(app)
      .delete(`/api/v1/sessions/${sessionId}/participants/${player.userId}`)
      .set(auth)
      .expect(403);
    expect(removed.body.error.code).toMatch(/FORBIDDEN|NOT_ORGANISER/);

    const refunded = await request(app)
      .post(`/api/v1/payments/${paymentId}/refund`)
      .set(auth)
      .set('Idempotency-Key', randomUUID())
      .send({ amountFils: 100 })
      .expect(403);
    expect(refunded.body.error.code).toMatch(/FORBIDDEN|NOT_ORGANISER/);

    const reminded = await request(app)
      .post(`/api/v1/sessions/${sessionId}/payments/remind`)
      .set(auth)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(403);
    expect(reminded.body.error.code).toMatch(/FORBIDDEN|NOT_ORGANISER/);

    const unauth = await request(app).post(`/api/v1/payments/${paymentId}/confirm`).send({}).expect(401);
    expect(unauth.body.error.code).toBe('UNAUTHENTICATED');

    const stillOpen = await request(app).get(`/api/v1/sessions/${sessionId}`).expect(200);
    expect(stillOpen.body.data.status).toBe('OPEN');
    expect(stillOpen.body.data.title).not.toBe('hijack');
  });

  it('player cannot act as organiser on payment confirm/waive', async () => {
    const { player, paymentId } = await sessionWithPlayer();
    const confirm = await request(app)
      .post(`/api/v1/payments/${paymentId}/confirm`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(403);
    expect(confirm.body.error.code).toBe('FORBIDDEN');
    const waive = await request(app)
      .post(`/api/v1/payments/${paymentId}/waive`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(403);
    expect(waive.body.error.code).toBe('FORBIDDEN');
  });
});
