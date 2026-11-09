import { afterAll, describe, expect, it } from 'vitest';
import { explainNearby } from '../src/modules/discovery/discovery.repository';
import { seedDiscoveryLoad } from '../prisma/seed/discovery-load';
import { createTestApp, pingTestDb } from './helpers';

const dbUp = await pingTestDb();
const MARINA = { lat: 25.0805, lng: 55.1403 };

describe.skipIf(!dbUp)('discovery load', { timeout: 180_000 }, () => {
  const { app, db, env } = createTestApp();

  afterAll(async () => {
    await db.$disconnect();
  });

  it('seeds 100k sessions, uses an index, and nearby p95 stays under 300ms', async () => {
    const count = await seedDiscoveryLoad(db, 100_000);
    expect(count).toBeGreaterThanOrEqual(100_000);

    const user = await db.user.upsert({
      where: { email: 'load-viewer@playaround.local' },
      update: {},
      create: {
        email: 'load-viewer@playaround.local',
        emailVerifiedAt: new Date(),
        profile: { create: { displayName: 'Load Viewer' } },
      },
    });
    const { signAccessToken } = await import('../src/lib/tokens');
    const { token } = await signAccessToken(env, { sub: user.id, role: 'USER', scope: 'app' });

    const plan = await explainNearby(db, {
      lat: MARINA.lat,
      lng: MARINA.lng,
      radiusKm: 5,
      now: new Date(),
      joinableOnly: false,
      from: new Date(),
      to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      minSpots: 1,
      sort: 'distance',
      limit: 20,
    });
    const usedIndex = plan.some((row) => {
      const key = String(row.key ?? row.Key ?? '');
      const type = String(row.type ?? row.Type ?? '');
      return key.length > 0 && key !== 'null' && type !== 'ALL';
    });
    expect(usedIndex, JSON.stringify(plan, (_key, value) => (typeof value === 'bigint' ? Number(value) : value))).toBe(
      true,
    );

    const { default: request } = await import('supertest');
    const { searchNearby } = await import('../src/modules/discovery/discovery.repository');
    const search = {
      lat: MARINA.lat,
      lng: MARINA.lng,
      radiusKm: 5,
      now: new Date(),
      joinableOnly: false,
      from: new Date(),
      to: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      minSpots: 1,
      sort: 'distance' as const,
      limit: 20,
    };
    for (let i = 0; i < 3; i += 1) await searchNearby(db, search);
    const samples: number[] = [];
    for (let i = 0; i < 25; i += 1) {
      const started = Date.now();
      await searchNearby(db, search);
      samples.push(Date.now() - started);
    }
    const http = await request(app)
      .get(`/api/v1/sessions/nearby?lat=${MARINA.lat}&lng=${MARINA.lng}&radiusKm=5&autoExpand=false`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(Array.isArray(http.body.data)).toBe(true);
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)]!;
    expect(p95, `p95=${p95}ms samples=${samples.join(',')}`).toBeLessThan(300);
  });
});
