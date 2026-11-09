import { randomUUID } from 'node:crypto';
import request, { type Test } from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { signAccessToken } from '../src/lib/tokens';
import { createTestApp, pingTestDb, resetDb } from './helpers';

const dbUp = await pingTestDb();

describe.skipIf(!dbUp)('admin RBAC', () => {
  const ctx = createTestApp();
  const { app, db, env } = ctx;

  beforeAll(async () => {
    await resetDb(db);
  });

  beforeEach(async () => {
    await resetDb(db);
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function staff(role: 'SUPPORT' | 'OPERATIONS' | 'SUPER_ADMIN') {
    const user = await db.user.create({
      data: {
        email: `${role.toLowerCase()}-${randomUUID()}@playaround.local`,
        role,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        profile: { create: { displayName: role } },
      },
    });
    const token = (await signAccessToken(env, { sub: user.id, role, scope: 'admin' })).token;
    return { token, userId: user.id };
  }

  async function member() {
    const user = await db.user.create({
      data: {
        email: `user-${randomUUID()}@example.com`,
        role: 'USER',
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: 'Player' } },
      },
    });
    return user;
  }

  function withStaff(req: Test, token: string) {
    return req.set('Authorization', `Bearer ${token}`).set('X-Client', 'admin');
  }

  it('lets every staff role read users and blocks SUPPORT from operations catalogue routes', async () => {
    const support = await staff('SUPPORT');
    const ops = await staff('OPERATIONS');
    await withStaff(request(app).get('/api/v1/admin/users'), support.token).expect(200);
    await withStaff(request(app).get('/api/v1/admin/users'), ops.token).expect(200);
    await withStaff(request(app).get('/api/v1/admin/venue-arrangements'), support.token).expect(403);
    await withStaff(request(app).get('/api/v1/admin/venue-arrangements'), ops.token).expect(200);
    await withStaff(request(app).get('/api/v1/admin/venues'), support.token).expect(403);
    await withStaff(request(app).get('/api/v1/admin/sports'), ops.token).expect(200);
  });

  it('blocks OPERATIONS from payment mutations and SUPPORT from suspend', async () => {
    const support = await staff('SUPPORT');
    const ops = await staff('OPERATIONS');
    const paymentId = randomUUID();
    await withStaff(request(app).post(`/api/v1/admin/payments/${paymentId}/confirm`), ops.token)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'ops should not confirm' })
      .expect(403);
    const target = await member();
    await withStaff(request(app).post(`/api/v1/admin/users/${target.id}/status`), support.token)
      .set('Idempotency-Key', randomUUID())
      .send({ status: 'SUSPENDED', reason: 'support cannot suspend' })
      .expect(403);
  });

  it('lets OPERATIONS suspend a member and writes an audit row with the reason', async () => {
    const ops = await staff('OPERATIONS');
    const target = await member();
    await withStaff(request(app).post(`/api/v1/admin/users/${target.id}/status`), ops.token)
      .set('Idempotency-Key', randomUUID())
      .send({ status: 'SUSPENDED', reason: 'repeat no-shows' })
      .expect(200);
    const logs = await db.adminAuditLog.findMany({ where: { targetId: target.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      actorId: ops.userId,
      action: 'user.suspend',
      reason: 'repeat no-shows',
    });
  });

  it('restricts settings and audit logs to SUPER_ADMIN', async () => {
    const support = await staff('SUPPORT');
    const ops = await staff('OPERATIONS');
    const superAdmin = await staff('SUPER_ADMIN');
    await withStaff(request(app).get('/api/v1/admin/settings'), support.token).expect(403);
    await withStaff(request(app).get('/api/v1/admin/audit-logs'), ops.token).expect(403);
    const settings = await withStaff(request(app).get('/api/v1/admin/settings'), superAdmin.token).expect(200);
    expect(typeof settings.body.data['sessions.min_lead_time_hours']).toBe('number');
    await withStaff(request(app).put('/api/v1/admin/settings/sessions.min_lead_time_hours'), superAdmin.token)
      .set('Idempotency-Key', randomUUID())
      .send({ value: 4, reason: 'trial of a longer lead time' })
      .expect(200);
    const logs = await db.adminAuditLog.findMany({ where: { action: 'settings.put' } });
    expect(logs[0]?.reason).toBe('trial of a longer lead time');
    await withStaff(request(app).get('/api/v1/admin/audit-logs'), superAdmin.token).expect(200);
  });

  it('lets SUPPORT confirm payments but not cancel sessions', async () => {
    const support = await staff('SUPPORT');
    const sessionId = randomUUID();
    await withStaff(request(app).post(`/api/v1/admin/sessions/${sessionId}/cancel`), support.token)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'support cannot cancel' })
      .expect(403);
    const paymentId = randomUUID();
    const confirm = await withStaff(request(app).post(`/api/v1/admin/payments/${paymentId}/confirm`), support.token)
      .set('Idempotency-Key', randomUUID())
      .send({ reason: 'player showed receipt' });
    expect(confirm.status).not.toBe(403);
  });
});
