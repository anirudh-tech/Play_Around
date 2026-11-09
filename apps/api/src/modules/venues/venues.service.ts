import type { CreateVenueBody } from '@playaround/contracts';
import { boundingBox, haversineKm } from '../../lib/geo';
import { AppError } from '../../lib/errors';
import type { Database } from '../../lib/prisma';
import { ensureVenue, type SessionCtx } from '../sessions/session.service';

function publicVenue(row: {
  id: string;
  name: string;
  addressLine: string;
  area: string | null;
  city: string;
  latitude: { toString(): string } | number;
  longitude: { toString(): string } | number;
  isVerified: boolean;
  googlePlaceId: string | null;
}) {
  return {
    id: row.id,
    name: row.name,
    addressLine: row.addressLine,
    area: row.area,
    city: row.city,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    isVerified: row.isVerified,
    googlePlaceId: row.googlePlaceId,
  };
}

export async function listSports(db: Database) {
  return db.sport.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
}

export async function searchVenues(
  db: Database,
  query: { q?: string; sportId?: number; city?: string },
) {
  const rows = await db.venue.findMany({
    where: {
      mergedIntoId: null,
      city: query.city ? { contains: query.city } : undefined,
      name: query.q ? { contains: query.q } : undefined,
      sports: query.sportId ? { some: { sportId: query.sportId } } : undefined,
    },
    take: 50,
    orderBy: { name: 'asc' },
  });
  return rows.map(publicVenue);
}

export async function nearbyVenues(
  db: Database,
  input: { lat: number; lng: number; radiusKm: number; sportId?: number },
) {
  const box = boundingBox(input.lat, input.lng, input.radiusKm);
  const rows = await db.venue.findMany({
    where: {
      mergedIntoId: null,
      latitude: { gte: box.minLat, lte: box.maxLat },
      longitude: { gte: box.minLng, lte: box.maxLng },
      sports: input.sportId ? { some: { sportId: input.sportId } } : undefined,
    },
  });
  return rows
    .map((row) => ({
      ...publicVenue(row),
      distanceKm: haversineKm(input.lat, input.lng, Number(row.latitude), Number(row.longitude)),
    }))
    .filter((row) => row.distanceKm <= input.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export async function getVenue(db: Database, id: string) {
  const row = await db.venue.findUnique({
    where: { id },
    include: { sports: { include: { sport: true } } },
  });
  if (!row || row.mergedIntoId) throw new AppError('NOT_FOUND', 'Venue not found.');
  return {
    ...publicVenue(row),
    sports: row.sports.map((link) => ({ id: link.sport.id, slug: link.sport.slug, name: link.sport.name })),
  };
}

export async function createVenue(ctx: SessionCtx, userId: string, body: CreateVenueBody) {
  const venue = await ensureVenue(ctx, userId, { newVenue: body });
  return publicVenue(venue);
}
