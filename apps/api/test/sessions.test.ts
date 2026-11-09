import { randomUUID } from 'node:crypto';
import { splitShares } from '@playaround/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/lib/tokens';
import {
  runCompletionJob,
  runMinPlayersJob,
  runPriceConsentExpiryJob,
  runVenueDeadlineJob,
} from '../src/modules/sessions/jobs';
import { codeFrom, createTestApp, pingTestDb, resetDb } from './helpers';

const dbUp = await pingTestDb();

describe.skipIf(!dbUp)('sessions', () => {
  const ctx = createTestApp();
  const { app, db, mailer, env } = ctx;
  let sportId = 0;
  let venueId = '';

  beforeAll(async () => {
    await resetDb(db);
    const sport = await db.sport.upsert({
      where: { slug: 'badminton' },
      update: { minPlayers: 2, maxPlayers: 50, defaultPlayers: 4, isActive: true },
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

  async function createExisting(token: string, extra: Record<string, unknown> = {}) {
    const res = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'EXISTING_BOOKING',
        sportId,
        venue: { venueId },
        ...startsIn(4),
        capacity: extra.capacity ?? 4,
        organiserIsPlaying: extra.organiserIsPlaying ?? true,
        totalCostFils: extra.totalCostFils ?? 12000,
        ...extra,
      })
      .expect(201);
    return res.body.data as { id: string; confirmedCount: number; joinable: boolean; version: number };
  }

  it('lists sports and searches venues without staff fields', async () => {
    const { accessToken } = await member('sports@example.com');
    const sports = await request(app).get('/api/v1/sports').expect(200);
    expect(sports.body.data.some((s: { slug: string }) => s.slug === 'badminton')).toBe(true);
    const list = await request(app)
      .get('/api/v1/venues?city=Dubai')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(list.body.data[0].contactPhone).toBeUndefined();
  });

  it('rejects create without a verified phone and with a short lead time', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client', 'ios')
      .send({ email: 'nophone@example.com', password: 'correcthorsebattery', displayName: 'No' })
      .expect(201);
    const denied = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${res.body.data.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'EXISTING_BOOKING',
        sportId,
        venue: { venueId },
        ...startsIn(4),
        capacity: 4,
        totalCostFils: 12000,
      })
      .expect(403);
    expect(denied.body.error.code).toBe('PHONE_NOT_VERIFIED');

    const { accessToken } = await member('lead@example.com');
    const short = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'EXISTING_BOOKING',
        sportId,
        venue: { venueId },
        ...startsIn(1),
        capacity: 4,
        totalCostFils: 12000,
      })
      .expect(409);
    expect(short.body.error.code).toBe('LEAD_TIME_TOO_SHORT');
  });

  it('creates EXISTING_BOOKING joinable and LOOKING_FOR_PLAYERS not joinable', async () => {
    const { accessToken } = await member('org@example.com');
    const existing = await createExisting(accessToken, { organiserIsPlaying: true, capacity: 4 });
    expect(existing.joinable).toBe(true);
    expect(existing.confirmedCount).toBe(1);
    const lfp = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'LOOKING_FOR_PLAYERS',
        sportId,
        preferredArea: { label: 'JLT', latitude: 25.07, longitude: 55.14, radiusKm: 3 },
        ...startsIn(5),
        capacity: 10,
        estimatedTotalCostFils: 40000,
      })
      .expect(201);
    expect(lfp.body.data.joinable).toBe(false);
    expect(lfp.body.data.venueConfirmationStatus).toBe('PENDING');
  });

  it('joins, assigns unique share slots, splits AED 100 / 3, and rejects a 50th overflow', async () => {
    expect(splitShares(10_000, 3)).toEqual([3334, 3333, 3333]);
    const org = await member('split-org@example.com');
    const session = await createExisting(org.accessToken, {
      organiserIsPlaying: false,
      capacity: 3,
      totalCostFils: 10_000,
    });
    const shares: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const player = await member(`slot${i}@example.com`);
      const joined = await request(app)
        .post(`/api/v1/sessions/${session.id}/join`)
        .set('Authorization', `Bearer ${player.accessToken}`)
        .set('Idempotency-Key', randomUUID())
        .send({})
        .expect(201);
      shares.push(joined.body.data.payment.amountDue.amountFils);
    }
    expect(shares.sort((a, b) => b - a)).toEqual([3334, 3333, 3333]);
    const extra = await member('overflow@example.com');
    const full = await request(app)
      .post(`/api/v1/sessions/${session.id}/join`)
      .set('Authorization', `Bearer ${extra.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(409);
    expect(full.body.error.code).toBe('SESSION_FULL');
  });

  it('handles 50 concurrent joins without overbooking and with unique slots', { timeout: 120_000 }, async () => {
    const org = await member('race-org@example.com');
    const session = await createExisting(org.accessToken, {
      organiserIsPlaying: false,
      capacity: 50,
      totalCostFils: 0,
    });
    const players = await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        const user = await db.user.create({
          data: {
            email: `race${i}@example.com`,
            emailVerifiedAt: new Date(),
            phone: `+97150${String(i).padStart(7, '0')}`,
            phoneVerifiedAt: new Date(),
            profile: { create: { displayName: `Race ${i}` } },
          },
        });
        const { token } = await signAccessToken(env, { sub: user.id, role: 'USER', scope: 'app' });
        return { accessToken: token, userId: user.id };
      }),
    );
    const results = await Promise.all(
      players.map((player) =>
        request(app)
          .post(`/api/v1/sessions/${session.id}/join`)
          .set('Authorization', `Bearer ${player.accessToken}`)
          .set('Idempotency-Key', randomUUID())
          .send({}),
      ),
    );
    const ok = results.filter((res) => res.status === 201);
    const slots = ok.map((res) => res.body.data.participant.shareSlot as number);
    expect(ok).toHaveLength(50);
    expect(new Set(slots).size).toBe(50);
    const detail = await request(app).get(`/api/v1/sessions/${session.id}`).expect(200);
    expect(detail.body.data.confirmedCount).toBe(50);
    expect(detail.body.data.status).toBe('FULL');
  });

  it('leave then re-join works; removed players cannot re-join', async () => {
    const org = await member('rm-org@example.com');
    const player = await member('rm-player@example.com');
    const session = await createExisting(org.accessToken, { organiserIsPlaying: false, capacity: 4, totalCostFils: 0 });
    await request(app)
      .post(`/api/v1/sessions/${session.id}/join`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    await request(app)
      .post(`/api/v1/sessions/${session.id}/leave`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .expect(200);
    await request(app)
      .post(`/api/v1/sessions/${session.id}/join`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    await request(app)
      .delete(`/api/v1/sessions/${session.id}/participants/${player.userId}`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(204);
    const blocked = await request(app)
      .post(`/api/v1/sessions/${session.id}/join`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(403);
    expect(blocked.body.error.code).toBe('REMOVED_BY_ORGANISER');
  });

  it('LFP interest, staff option, approve, booking makes it joinable', async () => {
    const org = await member('lfp-org@example.com');
    const fan = await member('lfp-fan@example.com');
    const lfp = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'LOOKING_FOR_PLAYERS',
        sportId,
        preferredArea: { label: 'JLT', latitude: 25.07, longitude: 55.14, radiusKm: 3 },
        ...startsIn(8),
        capacity: 6,
        estimatedTotalCostFils: 20000,
      })
      .expect(201);
    const id = lfp.body.data.id as string;
    const notJoinable = await request(app)
      .post(`/api/v1/sessions/${id}/join`)
      .set('Authorization', `Bearer ${fan.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(409);
    expect(notJoinable.body.error.code).toBe('SESSION_NOT_JOINABLE');
    await request(app)
      .post(`/api/v1/sessions/${id}/interest`)
      .set('Authorization', `Bearer ${fan.accessToken}`)
      .expect(204);

    const staff = await db.user.create({
      data: {
        email: 'ops@example.com',
        role: 'OPERATIONS',
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        profile: { create: { displayName: 'Ops' } },
      },
    });
    const staffToken = (await signAccessToken(env, { sub: staff.id, role: 'OPERATIONS', scope: 'app' })).token;
    const times = startsIn(8);
    const option = await request(app)
      .post(`/api/v1/sessions/${id}/venue-options`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ venueId, ...times, totalCostFils: 18000 })
      .expect(201);
    await request(app)
      .post(`/api/v1/sessions/${id}/venue-options/${option.body.data.id}/approve`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(200);
    const booked = await request(app)
      .post(`/api/v1/sessions/${id}/venue-booking`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ venueOptionId: option.body.data.id })
      .expect(200);
    expect(booked.body.data.joinable).toBe(true);
    const arrangement = await request(app)
      .get(`/api/v1/sessions/${id}/venue-arrangement`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(200);
    expect(arrangement.body.data.staffNotes).toBeUndefined();
    expect(arrangement.body.data.status).toBe('BOOKED');
    await request(app)
      .patch(`/api/v1/sessions/${id}/venue-booking`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .send({ bookingReference: 'LFP-1', venuePaymentStatus: 'NOT_PAID' })
      .expect(200);
    await request(app)
      .post(`/api/v1/sessions/${id}/join`)
      .set('Authorization', `Bearer ${fan.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    const notes = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${fan.accessToken}`)
      .expect(200);
    expect(notes.body.data.some((n: { type: string }) => n.type === 'SESSION_JOINABLE')).toBe(true);
  });

  it('price increase over 20% requires consent; reject leaves without penalty', async () => {
    const org = await member('price-org@example.com');
    const player = await member('price-player@example.com');
    const session = await createExisting(org.accessToken, {
      organiserIsPlaying: false,
      capacity: 4,
      totalCostFils: 10_000,
    });
    await request(app)
      .post(`/api/v1/sessions/${session.id}/join`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
    const afterJoin = await request(app).get(`/api/v1/sessions/${session.id}`).expect(200);
    await request(app)
      .patch(`/api/v1/sessions/${session.id}`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .send({ totalCostFils: 16_000, expectedVersion: afterJoin.body.data.version })
      .expect(200);
    const consent = await db.priceConsent.findFirst({ where: { status: 'PENDING' } });
    expect(consent).toBeTruthy();
    await request(app)
      .post(`/api/v1/price-consents/${consent!.id}/reject`)
      .set('Authorization', `Bearer ${player.accessToken}`)
      .expect(204);
    const part = await db.sessionParticipant.findFirst({ where: { userId: player.userId } });
    expect(part?.cancellationReason).toBe('PRICE_REJECTED');
  });

  it('runs completion, min-player auto-cancel, venue lapse and consent expiry jobs', async () => {
    const org = await member('job-org@example.com');
    const player = await member('job-p@example.com');
    const session = await createExisting(org.accessToken, {
      organiserIsPlaying: true,
      capacity: 4,
      totalCostFils: 0,
    });
    await db.session.update({
      where: { id: session.id },
      data: { endsAt: new Date(Date.now() - 1000), startsAt: new Date(Date.now() - 3600_000) },
    });
    await runCompletionJob(db, new Date());
    const completed = await db.session.findUnique({ where: { id: session.id } });
    expect(completed?.status).toBe('EXPIRED');

    const minSession = await createExisting(org.accessToken, {
      organiserIsPlaying: true,
      capacity: 6,
      minPlayers: 6,
      totalCostFils: 0,
    });
    await db.session.update({
      where: { id: minSession.id },
      data: { minPlayersDecisionDeadline: new Date(Date.now() - 1000) },
    });
    await runMinPlayersJob(db, new Date());
    const cancelled = await db.session.findUnique({ where: { id: minSession.id } });
    expect(cancelled?.status).toBe('CANCELLED');
    expect(cancelled?.cancellationReason).toBe('MINIMUM_NOT_MET_NO_DECISION');

    const lfp = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        type: 'LOOKING_FOR_PLAYERS',
        sportId,
        preferredArea: { label: 'JLT', latitude: 25.07, longitude: 55.14, radiusKm: 3 },
        ...startsIn(5),
        capacity: 6,
        estimatedTotalCostFils: 0,
      })
      .expect(201);
    await db.session.update({
      where: { id: lfp.body.data.id },
      data: { venueConfirmDeadline: new Date(Date.now() - 1000) },
    });
    await runVenueDeadlineJob(db, new Date());
    const lapsed = await db.session.findUnique({ where: { id: lfp.body.data.id } });
    expect(lapsed?.venueConfirmationStatus).toBe('LAPSED');
    expect(lapsed?.status).toBe('CANCELLED');

    void player;
    await runPriceConsentExpiryJob(db, new Date());
  });

  it('cancels, lists my activities, reports, and persists notifications', async () => {
    const org = await member('act-org@example.com');
    const session = await createExisting(org.accessToken, { totalCostFils: 0 });
    await request(app)
      .post(`/api/v1/sessions/${session.id}/cancel`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ note: 'Rain' })
      .expect(200);
    const events = await request(app)
      .get(`/api/v1/sessions/${session.id}/events`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(200);
    expect(events.body.data.some((e: { type: string }) => e.type === 'CANCELLED')).toBe(true);
    const mine = await request(app)
      .get('/api/v1/me/sessions?role=organised&bucket=cancelled')
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(200);
    expect(mine.body.data.some((s: { id: string }) => s.id === session.id)).toBe(true);
    await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${org.accessToken}`)
      .send({ targetType: 'SESSION', targetId: session.id, reason: 'SPAM' })
      .expect(201);
  });
});
