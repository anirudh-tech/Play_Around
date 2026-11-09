import { randomUUID } from 'node:crypto';
import { offsetByKm } from '@playaround/contracts';
import type { Database } from '../../src/lib/prisma';

export const LOAD_TITLE = 'load:discovery';
const HUBS = [
  { lat: 25.0805, lng: 55.1403, weight: 0.45 },
  { lat: 25.2048, lng: 55.2708, weight: 0.2 },
  { lat: 25.3463, lng: 55.4209, weight: 0.1 },
  { lat: 24.4539, lng: 54.3773, weight: 0.15 },
  { lat: 25.7889, lng: 55.9736, weight: 0.1 },
];

function pickHub() {
  const roll = Math.random();
  let acc = 0;
  for (const hub of HUBS) {
    acc += hub.weight;
    if (roll <= acc) return hub;
  }
  return HUBS[0]!;
}

export async function countLoadSessions(db: Database) {
  return db.session.count({ where: { title: LOAD_TITLE } });
}

export async function deleteLoadSessions(db: Database) {
  await db.session.deleteMany({ where: { title: LOAD_TITLE } });
}

export async function seedDiscoveryLoad(db: Database, total = 100_000) {
  const sport = await db.sport.upsert({
    where: { slug: 'badminton' },
    update: {},
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
  const venue = await db.venue.upsert({
    where: { googlePlaceId: 'seed-load-marina' },
    update: {},
    create: {
      googlePlaceId: 'seed-load-marina',
      name: 'Load Marina Hub',
      addressLine: 'Marina',
      area: 'Dubai Marina',
      city: 'Dubai',
      latitude: 25.0805,
      longitude: 55.1403,
    },
  });
  const organiser = await db.user.upsert({
    where: { email: 'load-organiser@playaround.local' },
    update: {},
    create: {
      email: 'load-organiser@playaround.local',
      emailVerifiedAt: new Date(),
      phoneVerifiedAt: new Date(),
      profile: { create: { displayName: 'Load Organiser' } },
    },
  });

  const existing = await countLoadSessions(db);
  if (existing >= total) return existing;

  const batch = 1000;
  const now = Date.now();
  for (let i = existing; i < total; i += batch) {
    const n = Math.min(batch, total - i);
    const values = Array.from({ length: n }, () => {
      const hub = pickHub();
      const point = offsetByKm(hub.lat, hub.lng, Math.random() * 40, Math.random() * 360);
      const id = randomUUID();
      const start = new Date(now + (4 + Math.random() * 200) * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const pending = Math.random() < 0.15;
      const type = pending ? 'LOOKING_FOR_PLAYERS' : 'EXISTING_BOOKING';
      const venueStatus = pending ? 'PENDING' : 'CONFIRMED';
      const precision = pending ? 'AREA' : 'EXACT';
      const area = pending ? '3.0' : 'NULL';
      const totalFils = pending ? 20000 : 12000;
      const share = pending ? 2000 : 3000;
      const est = pending ? String(totalFils) : 'NULL';
      const estShare = pending ? String(share) : 'NULL';
      const confirmed = pending ? 'NULL' : String(totalFils);
      const shareCol = pending ? 'NULL' : String(share);
      const venueCol = pending ? 'NULL' : `'${venue.id}'`;
      const stamp = start.toISOString().slice(0, 23).replace('T', ' ');
      const endStamp = end.toISOString().slice(0, 23).replace('T', ' ');
      return `('${id}','${organiser.id}',${sport.id},'${type}','OPEN','${venueStatus}','PUBLIC',${venueCol},${point.latitude.toFixed(6)},${point.longitude.toFixed(6)},'${precision}',${area},'${stamp}','${endStamp}',4,1,'AED',${est},${estShare},${confirmed},${shareCol},'${LOAD_TITLE}',0,NOW(3),NOW(3))`;
    });
    await db.$executeRawUnsafe(`
      INSERT INTO sessions (
        id, organiser_id, sport_id, session_type, status, venue_confirmation_status, visibility,
        venue_id, latitude, longitude, location_precision, area_radius_km, starts_at, ends_at,
        capacity, confirmed_count, currency, estimated_total_cost_fils, estimated_share_max_fils,
        total_cost_fils, share_max_fils, title, version, created_at, updated_at
      ) VALUES ${values.join(',')}
    `);
  }
  return total;
}
