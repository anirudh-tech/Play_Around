import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/lib/tokens';
import { codeFrom, createTestApp, pingTestDb, resetDb } from './helpers';

const dbUp = await pingTestDb();

describe.skipIf(!dbUp)('offline payments', () => {
  const ctx = createTestApp();
  const { app, db, mailer, env } = ctx;
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

  async function staffToken(role: 'SUPPORT' | 'OPERATIONS' | 'SUPER_ADMIN', email: string) {
    const user = await db.user.create({
      data: {
        email,
        role,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        profile: { create: { displayName: role } },
      },
    });
    const token = (await signAccessToken(env, { sub: user.id, role, scope: 'admin' })).token;
    return { token, userId: user.id };
  }

  function startsIn(hours: number) {
    const startsAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
  }

  async function paidSession() {
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
    const paymentId = joined.body.data.payment.id as string;
    return { org, player, stranger, sessionId, paymentId };
  }

  function act(token: string, path: string, body: object = {}) {
    return request(app)
      .post(`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', randomUUID())
      .send(body);
  }

  it('player reports and retracts; organiser confirms, waives, refunds', async () => {
    const { org, player, paymentId, sessionId } = await paidSession();
    const reported = await act(player.accessToken, `/payments/${paymentId}/report`, {
      method: 'CASH',
      reference: 'handed-over',
    }).expect(200);
    expect(reported.body.data.status).toBe('PAYMENT_REPORTED');
    const retracted = await act(player.accessToken, `/payments/${paymentId}/retract-report`, {}).expect(200);
    expect(retracted.body.data.status).toBe('UNPAID');
    await act(player.accessToken, `/payments/${paymentId}/report`, { method: 'BANK_TRANSFER', reference: 'TRX-1' }).expect(200);
    const confirmed = await act(org.accessToken, `/payments/${paymentId}/confirm`, {}).expect(200);
    expect(confirmed.body.data.status).toBe('PAID');
    const refunded = await act(org.accessToken, `/payments/${paymentId}/refund`, { amountFils: 2500 }).expect(200);
    expect(refunded.body.data.status).toBe('REFUNDED');
    expect(refunded.body.data.refundedAmount.amountFils).toBe(2500);

    const second = await paidSession();
    const waived = await act(second.org.accessToken, `/payments/${second.paymentId}/waive`, { note: 'Regular' }).expect(200);
    expect(waived.body.data.status).toBe('WAIVED');

    const overview = await request(app)
      .get(`/api/v1/sessions/${sessionId}/payments`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(200);
    expect(overview.body.data.payments.length).toBeGreaterThan(0);
    const mine = await request(app)
      .get('/api/v1/me/payments?role=payer')
      .set('Authorization', `Bearer ${player.accessToken}`)
      .expect(200);
    expect(mine.body.data.some((row: { id: string }) => row.id === paymentId)).toBe(true);
  });

  it('enforces who-may-change (IDOR)', async () => {
    const { org, player, stranger, paymentId } = await paidSession();
    const otherSees = await request(app)
      .get(`/api/v1/payments/${paymentId}`)
      .set('Authorization', `Bearer ${stranger.accessToken}`)
      .expect(403);
    expect(otherSees.body.error.code).toBe('FORBIDDEN');
    const playerConfirm = await act(player.accessToken, `/payments/${paymentId}/confirm`, {}).expect(403);
    expect(playerConfirm.body.error.code).toBe('FORBIDDEN');
    const orgReport = await act(org.accessToken, `/payments/${paymentId}/report`, { method: 'CASH' }).expect(403);
    expect(orgReport.body.error.code).toBe('FORBIDDEN');
    const strangerReport = await act(stranger.accessToken, `/payments/${paymentId}/report`, { method: 'CASH' }).expect(403);
    expect(strangerReport.body.error.code).toBe('FORBIDDEN');
    const strangerWaive = await act(stranger.accessToken, `/payments/${paymentId}/waive`, {}).expect(403);
    expect(strangerWaive.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects card-like payment references', async () => {
    const { player, paymentId } = await paidSession();
    const res = await act(player.accessToken, `/payments/${paymentId}/report`, {
      method: 'BANK_TRANSFER',
      reference: '4111111111111111',
    }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('opens, withdraws and staff-resolves disputes; reject-report opens a dispute', async () => {
    const { org, player, paymentId } = await paidSession();
    await act(player.accessToken, `/payments/${paymentId}/report`, { method: 'CASH' }).expect(200);
    const rejected = await act(org.accessToken, `/payments/${paymentId}/reject-report`, {
      reason: 'PAYMENT_NOT_RECEIVED',
      description: 'Did not receive cash',
    }).expect(200);
    expect(rejected.body.data.status).toBe('PAYMENT_DISPUTED');
    expect(rejected.body.data.openDispute).toBeTruthy();
    const again = await act(player.accessToken, `/payments/${paymentId}/disputes`, {
      reason: 'AMOUNT_INCORRECT',
    }).expect(409);
    expect(again.body.error.code).toBe('DISPUTE_ALREADY_OPEN');

    const withdrawn = await act(org.accessToken, `/payment-disputes/${rejected.body.data.openDispute.id}/withdraw`, {}).expect(200);
    expect(withdrawn.body.data.status).toBe('PAYMENT_REPORTED');

    const other = await paidSession();
    await act(other.player.accessToken, `/payments/${other.paymentId}/disputes`, { reason: 'PAYMENT_NOT_ACKNOWLEDGED' }).expect(200);
    const support = await staffToken('SUPPORT', `support-${randomUUID()}@playaround.local`);
    const listed = await request(app)
      .get('/api/v1/admin/payment-disputes?status=OPEN')
      .set('Authorization', `Bearer ${support.token}`)
      .expect(200);
    const disputeId = listed.body.data[0].id as string;
    const resolved = await request(app)
      .post(`/api/v1/admin/payment-disputes/${disputeId}/resolve`)
      .set('Authorization', `Bearer ${support.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ resolutionStatus: 'PAID', note: 'Player showed transfer screenshot', reason: 'evidence reviewed' })
      .expect(200);
    expect(resolved.body.data.status).toBe('PAID');
    const audit = await db.adminAuditLog.findFirst({ where: { action: 'payment_dispute.resolve' } });
    expect(audit?.reason).toBe('evidence reviewed');
  });

  it('serialises concurrent confirm actions', async () => {
    const { org, player, paymentId } = await paidSession();
    await act(player.accessToken, `/payments/${paymentId}/report`, { method: 'CASH' }).expect(200);
    const [first, second] = await Promise.all([
      act(org.accessToken, `/payments/${paymentId}/confirm`, {}),
      act(org.accessToken, `/payments/${paymentId}/confirm`, {}),
    ]);
    const codes = [first.status, second.status].sort();
    expect(codes).toContain(200);
    expect(codes.some((code) => code === 409)).toBe(true);
    const row = await db.payment.findUnique({ where: { id: paymentId } });
    expect(row?.status).toBe('PAID');
    expect(row?.amountPaidFils).toBe(row?.amountDueFils);
  });

  it('staff can correct status and list payments', async () => {
    const { paymentId } = await paidSession();
    const support = await staffToken('SUPPORT', `support2-${randomUUID()}@playaround.local`);
    const corrected = await request(app)
      .post(`/api/v1/admin/payments/${paymentId}/correct-status`)
      .set('Authorization', `Bearer ${support.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ status: 'WAIVED', reason: 'organiser request', note: 'goodwill' })
      .expect(200);
    expect(corrected.body.data.status).toBe('WAIVED');
    await request(app)
      .get('/api/v1/admin/payments')
      .set('Authorization', `Bearer ${support.token}`)
      .expect(200);
  });

  it('operations queue: assign, propose option, organiser GET hides staff notes, patch booking', async () => {
    const org = await member(`lfp-org-${randomUUID()}@example.com`);
    const fan = await member(`lfp-fan-${randomUUID()}@example.com`);
    const ops = await staffToken('OPERATIONS', `ops-${randomUUID()}@playaround.local`);
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
    const sessionId = lfp.body.data.id as string;
    const arrangement = await db.venueArrangement.findUnique({ where: { sessionId } });
    expect(arrangement).toBeTruthy();
    await request(app)
      .post(`/api/v1/admin/venue-arrangements/${arrangement!.id}/assign`)
      .set('Authorization', `Bearer ${ops.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ assigneeId: ops.userId, reason: 'taking this request' })
      .expect(200);
    await request(app)
      .patch(`/api/v1/admin/venue-arrangements/${arrangement!.id}`)
      .set('Authorization', `Bearer ${ops.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ staffNotes: 'Called venue, Saturday 8pm ok', reason: 'internal note' })
      .expect(200);
    const times = startsIn(8);
    const option = await request(app)
      .post(`/api/v1/admin/venue-arrangements/${arrangement!.id}/options`)
      .set('Authorization', `Bearer ${ops.token}`)
      .set('Idempotency-Key', randomUUID())
      .send({ venueId, ...times, totalCostFils: 18000, reason: 'option from venue' })
      .expect(201);
    const orgView = await request(app)
      .get(`/api/v1/sessions/${sessionId}/venue-arrangement`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(200);
    expect(orgView.body.data.staffNotes).toBeUndefined();
    expect(orgView.body.data.options.length).toBe(1);
    await request(app)
      .post(`/api/v1/sessions/${sessionId}/venue-options/${option.body.data.id}/approve`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(200);
    await request(app)
      .post(`/api/v1/sessions/${sessionId}/venue-booking`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({ venueOptionId: option.body.data.id })
      .expect(200);
    const patched = await request(app)
      .patch(`/api/v1/sessions/${sessionId}/venue-booking`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .send({ bookingReference: 'COURT-9', venuePaymentStatus: 'PAID' })
      .expect(200);
    expect(patched.body.data.bookingReference).toBe('COURT-9');
    expect(patched.body.data.venuePaymentStatus).toBe('PAID');
    await request(app)
      .post(`/api/v1/sessions/${sessionId}/join`)
      .set('Authorization', `Bearer ${fan.accessToken}`)
      .set('Idempotency-Key', randomUUID())
      .send({})
      .expect(201);
  });

  it('remind unpaid players at most once per 12 hours', async () => {
    const { org, sessionId } = await paidSession();
    const first = await act(org.accessToken, `/sessions/${sessionId}/payments/remind`, {}).expect(200);
    expect(first.body.data.reminded).toBe(1);
    const second = await act(org.accessToken, `/sessions/${sessionId}/payments/remind`, {}).expect(422);
    expect(second.body.error.code).toBe('DEADLINE_PASSED');
  });
});
