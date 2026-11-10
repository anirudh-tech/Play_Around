import {
  boundingBox,
  DISCOVERY_DEFAULT_WINDOW_DAYS,
  TIME_OF_DAY_HOURS,
  type NearbyQuery,
  type TimeOfDay,
} from '@playaround/contracts';
import { Prisma } from '../../generated/prisma/client';
import type { Database } from '../../lib/prisma';

export interface DiscoveryHit {
  id: string;
  distanceM: number;
  priceFils: number;
  startsAt: Date;
}

export interface DiscoverySearch {
  lat: number;
  lng: number;
  radiusKm: number;
  now: Date;
  joinableOnly: boolean;
  sportIds?: number[];
  types?: Array<'EXISTING_BOOKING' | 'LOOKING_FOR_PLAYERS'>;
  from: Date;
  to: Date;
  timeOfDay?: TimeOfDay[];
  minPriceFils?: number;
  maxPriceFils?: number;
  minSpots: number;
  skillLevel?: NearbyQuery['skillLevel'];
  sort: NonNullable<NearbyQuery['sort']>;
  limit: number;
  cursor?: DiscoveryCursor;
}

export type DiscoveryCursor =
  | { sort: 'distance'; distanceM: number; startsAt: string; id: string }
  | { sort: 'soonest'; startsAt: string; distanceM: number; id: string }
  | { sort: 'price'; priceFils: number; distanceM: number; id: string }
  | { sort: 'recommended'; offset: number };

function distanceSql(lat: number, lng: number) {
  return Prisma.sql`GREATEST(0,
    6371000 * acos(LEAST(1, GREATEST(-1,
      cos(radians(${lat})) * cos(radians(s.latitude::float)) * cos(radians(s.longitude::float) - radians(${lng}))
      + sin(radians(${lat})) * sin(radians(s.latitude::float))
    )))
    - CASE
        WHEN s.location_precision::text = 'AREA' AND s.area_radius_km IS NOT NULL
        THEN s.area_radius_km::float * 1000
        ELSE 0
      END
  )`;
}

function filters(input: DiscoverySearch) {
  const box = boundingBox(input.lat, input.lng, input.radiusKm);
  const parts: Prisma.Sql[] = [
    Prisma.sql`s.status::text = 'OPEN'`,
    Prisma.sql`s.visibility::text = 'PUBLIC'`,
    Prisma.sql`s.starts_at > ${input.from}`,
    Prisma.sql`s.starts_at <= ${input.to}`,
    Prisma.sql`s.latitude BETWEEN ${box.minLat} AND ${box.maxLat}`,
    Prisma.sql`s.longitude BETWEEN ${box.minLng} AND ${box.maxLng}`,
    Prisma.sql`(s.capacity - s.confirmed_count) >= ${input.minSpots}`,
  ];
  if (input.joinableOnly) {
    parts.push(Prisma.sql`s.venue_confirmation_status::text = 'CONFIRMED'`);
  }
  if (input.sportIds?.length) {
    parts.push(Prisma.sql`s.sport_id IN (${Prisma.join(input.sportIds)})`);
  }
  if (input.types?.length) {
    parts.push(Prisma.sql`s.session_type::text IN (${Prisma.join(input.types)})`);
  }
  if (input.skillLevel) {
    parts.push(Prisma.sql`s.skill_level::text = ${input.skillLevel}`);
  }
  if (input.minPriceFils != null) {
    parts.push(
      Prisma.sql`COALESCE(s.share_max_fils, s.estimated_share_max_fils, 0) >= ${input.minPriceFils}`,
    );
  }
  if (input.maxPriceFils != null) {
    parts.push(
      Prisma.sql`COALESCE(s.share_max_fils, s.estimated_share_max_fils, 0) <= ${input.maxPriceFils}`,
    );
  }
  if (input.timeOfDay?.length) {
    const hour = Prisma.sql`EXTRACT(HOUR FROM (s.starts_at AT TIME ZONE 'Asia/Dubai'))`;
    const slots = input.timeOfDay.map((slot) => {
      const { start, end } = TIME_OF_DAY_HOURS[slot];
      if (start < end) return Prisma.sql`(${hour} >= ${start} AND ${hour} < ${end})`;
      return Prisma.sql`(${hour} >= ${start} OR ${hour} < ${end})`;
    });
    parts.push(Prisma.sql`(${Prisma.join(slots, ' OR ')})`);
  }
  return Prisma.join(parts, ' AND ');
}

function orderSql(sort: DiscoverySearch['sort']) {
  if (sort === 'soonest') return Prisma.sql`x.starts_at ASC, x.distance_m ASC, x.id ASC`;
  if (sort === 'price') return Prisma.sql`x.price_fils ASC, x.distance_m ASC, x.id ASC`;
  return Prisma.sql`x.distance_m ASC, x.starts_at ASC, x.id ASC`;
}

function cursorSql(cursor: DiscoveryCursor | undefined) {
  if (!cursor || cursor.sort === 'recommended') return Prisma.sql`TRUE`;
  if (cursor.sort === 'distance') {
    return Prisma.sql`(x.distance_m, x.starts_at, x.id) > (${cursor.distanceM}, ${new Date(cursor.startsAt)}, ${cursor.id})`;
  }
  if (cursor.sort === 'soonest') {
    return Prisma.sql`(x.starts_at, x.distance_m, x.id) > (${new Date(cursor.startsAt)}, ${cursor.distanceM}, ${cursor.id})`;
  }
  return Prisma.sql`(x.price_fils, x.distance_m, x.id) > (${cursor.priceFils}, ${cursor.distanceM}, ${cursor.id})`;
}

function innerSelect(input: DiscoverySearch) {
  const dist = distanceSql(input.lat, input.lng);
  return Prisma.sql`
    SELECT
      s.id,
      ${dist} AS distance_m,
      COALESCE(s.share_max_fils, s.estimated_share_max_fils, 0) AS price_fils,
      s.starts_at
    FROM sessions s
    WHERE ${filters(input)}
  `;
}

export function nearbySelectSql(input: DiscoverySearch, take: number) {
  return Prisma.sql`
    SELECT x.id, x.distance_m, x.price_fils, x.starts_at
    FROM (${innerSelect(input)}) x
    WHERE x.distance_m <= ${input.radiusKm * 1000}
      AND ${cursorSql(input.cursor)}
    ORDER BY ${orderSql(input.sort)}
    LIMIT ${take}
  `;
}

export async function searchNearby(db: Database, input: DiscoverySearch): Promise<DiscoveryHit[]> {
  const take = input.sort === 'recommended' ? 1000 : input.limit + 1;
  const rows = await db.$queryRaw<Array<{ id: string; distance_m: number; price_fils: number; starts_at: Date }>>(
    nearbySelectSql(input, take),
  );
  return rows.map((row) => ({
    id: row.id,
    distanceM: Number(row.distance_m),
    priceFils: Number(row.price_fils),
    startsAt: new Date(row.starts_at),
  }));
}

export async function explainNearby(db: Database, input: DiscoverySearch) {
  const rows = await db.$queryRaw<Array<Record<string, unknown>>>(
    Prisma.sql`EXPLAIN ${nearbySelectSql(input, input.limit)}`,
  );
  return rows;
}

export function defaultWindow(now: Date): { from: Date; to: Date } {
  return {
    from: now,
    to: new Date(now.getTime() + DISCOVERY_DEFAULT_WINDOW_DAYS * 24 * 60 * 60 * 1000),
  };
}
