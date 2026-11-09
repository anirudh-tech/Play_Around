import { randomUUID } from 'node:crypto';
import { offsetByKm } from '@playaround/contracts';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { codeFrom, createTestApp, pingTestDb, resetDb } from './helpers';

const dbUp = await pingTestDb();
const MARINA = { lat: 25.0805, lng: 55.1403 };

describe.skipIf(!dbUp)('discovery', () => {
  const ctx = createTestApp();
  const { app, db, env, mailer } = ctx;
  let sportId = 0;
  let venueId = '';
  let token = '';
  let userId = '';

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
        googlePlaceId: `disc-${randomUUID()}`,
        name: 'Marina Hub',
        addressLine: 'Marina',
        area: 'Dubai Marina',
        city: 'Dubai',
        latitude: MARINA.lat,
        longitude: MARINA.lng,
      },
    });
    venueId = venue.id;
    const registered = await request(app)
      .post('/api/v1/auth/register')
      .set('X-Client', 'ios')
      .send({ email: 'finder@example.com', password: 'correcthorsebattery', displayName: 'Finder' })
      .expect(201);
    token = registered.body.data.accessToken as string;
    userId = registered.body.data.user.id as string;
    const code = codeFrom(mailer.outbox.at(-1)!.text);
    await request(app)
      .post('/api/v1/auth/verify-email')
      .set('Authorization', `Bearer ${token}`)
      .send({ code })
      .expect(204);
    await db.userFavouriteSport.create({
      data: { userId, sportId, skillLevel: 'INTERMEDIATE' },
    });
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  async function organiser() {
    const user = await db.user.create({
      data: {
        email: `org-${randomUUID()}@example.com`,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
        profile: { create: { displayName: 'Org' } },
      },
    });
    return user.id;
  }

  async function place(km: number, extra: Record<string, unknown> = {}) {
    const point = offsetByKm(MARINA.lat, MARINA.lng, km, 90);
    const startsAt = extra.startsAt instanceof Date ? extra.startsAt : new Date(Date.now() + 5 * 60 * 60 * 1000);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    const { startsAt: _s, endsAt: _e, ...rest } = extra;
    return db.session.create({
      data: {
        organiserId: await organiser(),
        sportId,
        sessionType: 'EXISTING_BOOKING',
        status: 'OPEN',
        venueConfirmationStatus: 'CONFIRMED',
        venueId,
        visibility: 'PUBLIC',
        latitude: point.latitude,
        longitude: point.longitude,
        locationPrecision: 'EXACT',
        startsAt,
        endsAt,
        capacity: 4,
        confirmedCount: 1,
        totalCostFils: 12000,
        shareMaxFils: 3000,
        title: `${km}km`,
        ...rest,
      },
    });
  }

  function nearby(query: string) {
    return request(app)
      .get(`/api/v1/sessions/nearby?lat=${MARINA.lat}&lng=${MARINA.lng}&${query}`)
      .set('Authorization', `Bearer ${token}`);
  }

  it('bands, order, auto-expansion, and hides full/past/cancelled', async () => {
    const at08 = await place(0.8);
    const at3 = await place(3);
    const at7 = await place(7);
    const at15 = await place(15);
    const at20 = await place(20);
    const at40 = await place(40);
    await place(1, { status: 'FULL', confirmedCount: 4, capacity: 4, title: 'full' });
    await place(1, { status: 'CANCELLED', title: 'cancelled' });
    await place(1, { startsAt: new Date(Date.now() - 60 * 60 * 1000), title: 'past' });
    await place(1, { visibility: 'UNLISTED', title: 'unlisted' });

    const expanded = await nearby('radiusKm=5&autoExpand=true').expect(200);
    expect(expanded.body.meta.requestedRadiusKm).toBe(5);
    expect(expanded.body.meta.expanded).toBe(true);
    expect(expanded.body.meta.radiusUsedKm).toBe(25);
    const ids = expanded.body.data.map((row: { id: string }) => row.id);
    expect(ids).toEqual([at08.id, at3.id, at7.id, at15.id, at20.id]);
    expect(expanded.body.data.map((row: { band: string }) => row.band)).toEqual([
      'LE_2',
      'LE_5',
      'LE_10',
      'LE_25',
      'LE_25',
    ]);
    expect(ids).not.toContain(at40.id);
    expect(expanded.body.data.every((row: { title: string }) => !['full', 'cancelled', 'past', 'unlisted'].includes(row.title))).toBe(
      true,
    );

    const tight = await nearby('radiusKm=5&autoExpand=false').expect(200);
    expect(tight.body.meta.expanded).toBe(false);
    expect(tight.body.data.map((row: { id: string }) => row.id)).toEqual([at08.id, at3.id]);
  });

  it('shows pending LFP as not joinable and hides it with joinableOnly', async () => {
    const point = offsetByKm(MARINA.lat, MARINA.lng, 1, 90);
    const startsAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const lfp = await db.session.create({
      data: {
        organiserId: await organiser(),
        sportId,
        sessionType: 'LOOKING_FOR_PLAYERS',
        status: 'OPEN',
        venueConfirmationStatus: 'PENDING',
        visibility: 'PUBLIC',
        latitude: point.latitude,
        longitude: point.longitude,
        locationPrecision: 'AREA',
        preferredAreaLabel: 'Marina',
        areaRadiusKm: 3,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        capacity: 10,
        estimatedTotalCostFils: 40000,
        estimatedShareMaxFils: 4000,
        title: 'lfp',
      },
    });
    await place(0.8, { title: 'exact' });
    const listed = await nearby('radiusKm=5&autoExpand=false').expect(200);
    const pending = listed.body.data.find((row: { id: string }) => row.id === lfp.id);
    expect(pending.joinable).toBe(false);
    expect(pending.band).toBe('LE_2');
    expect(pending.location.precision).toBe('AREA');
    const only = await nearby('radiusKm=5&autoExpand=false&joinableOnly=true').expect(200);
    expect(only.body.data.some((row: { id: string }) => row.id === lfp.id)).toBe(false);
  });

  it('never returns staff-only venue fields', async () => {
    const venue = await db.venue.create({
      data: {
        googlePlaceId: `staff-${randomUUID()}`,
        name: 'Staff Court',
        addressLine: '1 Hidden',
        area: 'Marina',
        city: 'Dubai',
        latitude: MARINA.lat,
        longitude: MARINA.lng,
        contactPhone: '+971500000000',
        contactEmail: 'hidden@example.com',
        staffNotes: 'secret',
      },
    });
    const startsAt = new Date(Date.now() + 5 * 60 * 60 * 1000);
    await db.session.create({
      data: {
        organiserId: await organiser(),
        sportId,
        sessionType: 'EXISTING_BOOKING',
        status: 'OPEN',
        venueConfirmationStatus: 'CONFIRMED',
        venueId: venue.id,
        latitude: MARINA.lat,
        longitude: MARINA.lng,
        locationPrecision: 'EXACT',
        startsAt,
        endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000),
        capacity: 4,
        confirmedCount: 1,
        totalCostFils: 0,
        shareMaxFils: 0,
      },
    });
    const res = await nearby('radiusKm=5&autoExpand=false').expect(200);
    const blob = JSON.stringify(res.body);
    expect(blob).not.toContain('+971500000000');
    expect(blob).not.toContain('hidden@example.com');
    expect(blob).not.toContain('secret');
    expect(res.body.data[0].location.venue.name).toBe('Staff Court');
  });

  it('paginates by distance and sorts by soonest', async () => {
    const first = await place(0.5, { title: 'a' });
    const second = await place(1.0, { title: 'b' });
    const third = await place(1.5, { title: 'c' });
    const page1 = await nearby('radiusKm=5&autoExpand=false&limit=2&sort=distance').expect(200);
    expect(page1.body.data.map((row: { id: string }) => row.id)).toEqual([first.id, second.id]);
    expect(page1.body.meta.nextCursor).toBeTruthy();
    const page2 = await nearby(
      `radiusKm=5&autoExpand=false&limit=2&sort=distance&cursor=${encodeURIComponent(page1.body.meta.nextCursor)}`,
    ).expect(200);
    expect(page2.body.data.map((row: { id: string }) => row.id)).toEqual([third.id]);

    const later = new Date(Date.now() + 10 * 60 * 60 * 1000);
    await db.session.update({ where: { id: first.id }, data: { startsAt: later, endsAt: new Date(later.getTime() + 3600_000) } });
    const soonest = await nearby('radiusKm=5&autoExpand=false&sort=soonest').expect(200);
    expect(soonest.body.data[0].id).not.toBe(first.id);
  });

  it('filters by type, price and time of day', async () => {
    await place(0.8, { totalCostFils: 40000, shareMaxFils: 10000, title: 'pricey' });
    const cheapStart = new Date(Date.now() + 5 * 60 * 60 * 1000);
    cheapStart.setUTCHours(6, 0, 0, 0);
    if (cheapStart.getTime() <= Date.now()) cheapStart.setUTCDate(cheapStart.getUTCDate() + 1);
    await place(0.8, {
      totalCostFils: 4000,
      shareMaxFils: 1000,
      title: 'morning',
      startsAt: cheapStart,
    });
    const price = await nearby('radiusKm=5&autoExpand=false&maxPriceFils=2000').expect(200);
    expect(price.body.data.every((row: { title: string }) => row.title === 'morning')).toBe(true);
    const morning = await nearby('radiusKm=5&autoExpand=false&timeOfDay=morning').expect(200);
    expect(morning.body.data.some((row: { title: string }) => row.title === 'morning')).toBe(true);
    const types = await nearby('radiusKm=5&autoExpand=false&types=LOOKING_FOR_PLAYERS').expect(200);
    expect(types.body.data).toHaveLength(0);
  });

  it('requires auth', async () => {
    await request(app).get(`/api/v1/sessions/nearby?lat=${MARINA.lat}&lng=${MARINA.lng}`).expect(401);
    void env;
  });
});
