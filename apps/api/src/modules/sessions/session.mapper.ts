import { isJoinable, money, type SessionSummary } from '@playaround/contracts';

const PAYMENT_NOTE = "Pay the organiser directly. PlayAround doesn't collect payments.";

type SessionRow = {
  id: string;
  sessionType: SessionSummary['type'];
  status: SessionSummary['status'];
  venueConfirmationStatus: SessionSummary['venueConfirmationStatus'];
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  venueConfirmDeadline: Date | null;
  capacity: number;
  minPlayers: number | null;
  confirmedCount: number;
  interestedCount: number;
  estimatedTotalCostFils: number | null;
  estimatedShareMaxFils: number | null;
  totalCostFils: number | null;
  shareMaxFils: number | null;
  skillLevel: SessionSummary['skillLevel'];
  version: number;
  title: string | null;
  organiserIsPlaying: boolean;
  preferredAreaLabel: string | null;
  areaRadiusKm: { toString(): string } | number | null;
  latitude: { toString(): string } | number;
  longitude: { toString(): string } | number;
  locationPrecision: SessionSummary['location']['precision'];
  sport: { id: number; slug: string; name: string; accentColor: string };
  venue: { id: string; name: string; area: string | null; city: string } | null;
  organiser: {
    id: string;
    profile: { displayName: string; avatarUrl: string | null; ratingAvg: { toString(): string } | number } | null;
  };
};

export function toSummary(row: SessionRow, now: Date): SessionSummary {
  const confirmed = venueConfirmed(row);
  const total = confirmed ? row.totalCostFils : row.estimatedTotalCostFils;
  const shareMax = confirmed ? row.shareMaxFils : row.estimatedShareMaxFils;
  const lat = Number(row.latitude);
  const lng = Number(row.longitude);
  return {
    id: row.id,
    type: row.sessionType,
    status: row.status,
    venueConfirmationStatus: row.venueConfirmationStatus,
    joinable: isJoinable({
      status: row.status,
      venueConfirmationStatus: row.venueConfirmationStatus,
      startsAt: row.startsAt,
      now,
    }),
    sport: {
      id: row.sport.id,
      slug: row.sport.slug,
      name: row.sport.name,
      accentColor: row.sport.accentColor,
    },
    location: {
      precision: row.locationPrecision,
      label: row.venue?.name ?? row.preferredAreaLabel ?? 'UAE',
      latitude: lat,
      longitude: lng,
      areaRadiusKm: row.areaRadiusKm == null ? null : Number(row.areaRadiusKm),
      venue: row.venue
        ? { id: row.venue.id, name: row.venue.name, area: row.venue.area, city: row.venue.city }
        : null,
    },
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    venueConfirmDeadline: row.venueConfirmDeadline?.toISOString() ?? null,
    capacity: row.capacity,
    minPlayers: row.minPlayers,
    confirmedCount: row.confirmedCount,
    interestedCount: row.interestedCount,
    spotsLeft: Math.max(0, row.capacity - row.confirmedCount),
    price: {
      isEstimate: !confirmed,
      isFree: (total ?? 0) === 0,
      perPlayerMax: shareMax == null ? null : money(shareMax),
      total: total == null ? null : money(total),
    },
    paymentNote: PAYMENT_NOTE,
    skillLevel: row.skillLevel,
    organiser: {
      id: row.organiser.id,
      displayName: row.organiser.profile?.displayName ?? 'Player',
      avatarUrl: row.organiser.profile?.avatarUrl ?? null,
      ratingAvg: Number(row.organiser.profile?.ratingAvg ?? 0),
      isPlaying: row.organiserIsPlaying,
    },
    version: row.version,
    title: row.title,
  };
}

function venueConfirmed(row: SessionRow): boolean {
  return row.venueConfirmationStatus === 'CONFIRMED';
}

export const sessionInclude = {
  sport: true,
  venue: true,
  organiser: { include: { profile: true } },
} as const;
