import {
  DISCOVERY_MIN_RESULTS,
  PLATFORM_SETTING_DEFAULTS,
  distanceBand,
  expandRadii,
  recommendationScore,
  type NearbyQuery,
  type NearbySession,
  type SessionSummary,
} from '@playaround/contracts';
import { AppError } from '../../lib/errors';
import type { Database } from '../../lib/prisma';
import { sessionInclude, toSummary } from '../sessions/session.mapper';
import {
  defaultWindow,
  searchNearby,
  type DiscoveryCursor,
  type DiscoveryHit,
  type DiscoverySearch,
} from './discovery.repository';

const MAX_RADIUS = PLATFORM_SETTING_DEFAULTS['discovery.max_radius_km'];

export function encodeCursor(cursor: DiscoveryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined, sort: DiscoverySearch['sort']): DiscoveryCursor | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as DiscoveryCursor;
    if (parsed.sort !== sort) throw new Error('sort mismatch');
    return parsed;
  } catch {
    throw new AppError('VALIDATION_ERROR', 'Invalid cursor.');
  }
}

function nextCursor(sort: DiscoverySearch['sort'], last: DiscoveryHit, offset: number): DiscoveryCursor {
  if (sort === 'recommended') return { sort, offset };
  if (sort === 'soonest') {
    return { sort, startsAt: last.startsAt.toISOString(), distanceM: last.distanceM, id: last.id };
  }
  if (sort === 'price') {
    return { sort, priceFils: last.priceFils, distanceM: last.distanceM, id: last.id };
  }
  return {
    sort: 'distance',
    distanceM: last.distanceM,
    startsAt: last.startsAt.toISOString(),
    id: last.id,
  };
}

async function hydrate(
  db: Database,
  hits: DiscoveryHit[],
  viewerId: string,
  now: Date,
): Promise<NearbySession[]> {
  if (hits.length === 0) return [];
  const ids = hits.map((hit) => hit.id);
  const [rows, mineRows, interestRows, previewRows] = await Promise.all([
    db.session.findMany({ where: { id: { in: ids } }, include: sessionInclude }),
    db.sessionParticipant.findMany({
      where: { sessionId: { in: ids }, userId: viewerId },
      include: { payment: true, priceConsents: { where: { status: 'PENDING' }, take: 1 } },
    }),
    db.sessionInterest.findMany({ where: { sessionId: { in: ids }, userId: viewerId } }),
    db.sessionParticipant.findMany({
      where: { sessionId: { in: ids }, status: { in: ['CONFIRMED', 'ATTENDED'] } },
      select: { sessionId: true, userId: true, user: { select: { profile: { select: { avatarUrl: true } } } } },
    }),
  ]);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const mineBySession = new Map(mineRows.map((row) => [row.sessionId, row]));
  const interested = new Set(interestRows.map((row) => row.sessionId));
  const previewBySession = new Map<string, (typeof previewRows)[number][]>();
  for (const row of previewRows) {
    const list = previewBySession.get(row.sessionId) ?? [];
    if (list.length < 3) list.push(row);
    previewBySession.set(row.sessionId, list);
  }
  return hits.flatMap((hit) => {
    const row = byId.get(hit.id);
    if (!row) return [];
    const summary: SessionSummary = toSummary(row, now);
    const mine = mineBySession.get(hit.id);
    const distanceKm = Math.round((hit.distanceM / 1000) * 10) / 10;
    const item: NearbySession = {
      ...summary,
      distanceKm,
      band: distanceBand(distanceKm),
      participantPreview: (previewBySession.get(hit.id) ?? []).map((p) => ({
        id: p.userId,
        avatarUrl: p.user.profile?.avatarUrl ?? null,
      })),
      viewer: {
        participantStatus: mine?.status ?? null,
        isInterested: interested.has(hit.id),
        paymentStatus: mine?.payment?.status ?? null,
        amountDue: mine?.payment ? { amountFils: mine.payment.amountDueFils, currency: 'AED' } : null,
        pendingPriceConsentId: mine?.priceConsents[0]?.id ?? null,
      },
    };
    return [item];
  });
}

async function loadViewer(db: Database, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { profile: true, favouriteSports: true },
  });
  return {
    defaultRadiusKm: user?.profile?.defaultRadiusKm ?? PLATFORM_SETTING_DEFAULTS['discovery.default_radius_km'],
    favourites: new Map(user?.favouriteSports.map((f) => [f.sportId, f.skillLevel]) ?? []),
  };
}

function toSearch(
  query: NearbyQuery,
  radiusKm: number,
  now: Date,
  cursor: DiscoveryCursor | undefined,
): DiscoverySearch {
  const window = defaultWindow(now);
  return {
    lat: query.lat,
    lng: query.lng,
    radiusKm,
    now,
    joinableOnly: query.joinableOnly === true,
    sportIds: query.sportIds,
    types: query.types,
    from: query.from ? new Date(query.from) : window.from,
    to: query.to ? new Date(query.to) : window.to,
    timeOfDay: query.timeOfDay,
    minPriceFils: query.minPriceFils,
    maxPriceFils: query.maxPriceFils,
    minSpots: query.minSpots ?? 1,
    skillLevel: query.skillLevel,
    sort: query.sort ?? 'distance',
    limit: query.limit ?? 20,
    cursor,
  };
}

export async function nearbySessions(db: Database, viewerId: string, query: NearbyQuery, now = new Date()) {
  const viewer = await loadViewer(db, viewerId);
  const requestedRadiusKm = Math.min(MAX_RADIUS, query.radiusKm ?? viewer.defaultRadiusKm);
  const sort = query.sort ?? 'distance';
  const autoExpand = query.autoExpand !== false && !query.cursor;
  const radii = expandRadii(requestedRadiusKm, autoExpand);
  const cursor = decodeCursor(query.cursor, sort);
  const limit = query.limit ?? 20;

  let used = requestedRadiusKm;
  let hits: DiscoveryHit[] = [];
  for (const radiusKm of radii) {
    used = radiusKm;
    const search = toSearch(query, radiusKm, now, cursor);
    hits = await searchNearby(db, search);
    if (!autoExpand || hits.length >= DISCOVERY_MIN_RESULTS || radiusKm === radii.at(-1)) break;
  }

  if (sort === 'recommended') {
    const rows = await db.session.findMany({
      where: { id: { in: hits.map((hit) => hit.id) } },
      include: { sport: true },
    });
    const meta = new Map(rows.map((row) => [row.id, row]));
    const scored = hits
      .map((hit) => {
        const row = meta.get(hit.id);
        const skill = row ? viewer.favourites.get(row.sportId) ?? null : null;
        const hours = (hit.startsAt.getTime() - now.getTime()) / (60 * 60 * 1000);
        const score = recommendationScore({
          favouriteSport: row ? viewer.favourites.has(row.sportId) : false,
          viewerSkill: skill,
          sessionSkill: row?.skillLevel ?? null,
          distanceKm: hit.distanceM / 1000,
          radiusKm: used,
          hoursUntilStart: hours,
          venueConfirmed: row?.venueConfirmationStatus === 'CONFIRMED',
        });
        return { hit, score };
      })
      .sort((a, b) => b.score - a.score || a.hit.id.localeCompare(b.hit.id));
    const offset = cursor?.sort === 'recommended' ? cursor.offset : 0;
    const page = scored.slice(offset, offset + limit + 1);
    const extra = page.length > limit;
    const pageHits = extra ? page.slice(0, limit).map((s) => s.hit) : page.map((s) => s.hit);
    const data = await hydrate(db, pageHits, viewerId, now);
    return {
      data,
      meta: {
        requestedRadiusKm,
        radiusUsedKm: used,
        expanded: used > requestedRadiusKm + 1e-9,
        nextCursor: extra ? encodeCursor({ sort: 'recommended', offset: offset + limit }) : null,
      },
    };
  }

  const extra = hits.length > limit;
  const pageHits = extra ? hits.slice(0, limit) : hits;
  const data = await hydrate(db, pageHits, viewerId, now);
  const last = pageHits.at(-1);
  return {
    data,
    meta: {
      requestedRadiusKm,
      radiusUsedKm: used,
      expanded: used > requestedRadiusKm + 1e-9,
      nextCursor: extra && last ? encodeCursor(nextCursor(sort, last, 0)) : null,
    },
  };
}
