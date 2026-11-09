import type { DistanceBand, SkillLevel } from '../enums';

export const KM_PER_DEG_LAT = 111.045;
export const RADIUS_LADDER_KM = [2, 5, 10, 25, 50] as const;
export const DISCOVERY_MIN_RESULTS = 5;
export const DISCOVERY_DEFAULT_WINDOW_DAYS = 14;

/** v1 recommendation weights from location-discovery.md. */
export const RECOMMENDATION_WEIGHTS = {
  favouriteSport: 0.35,
  skillMatch: 0.2,
  proximity: 0.25,
  soonness: 0.15,
  venueConfirmed: 0.05,
} as const;

/** Hour ranges in Asia/Dubai (UTC+4, no DST) for `timeOfDay`. Night wraps midnight. */
export const TIME_OF_DAY_HOURS: Record<'morning' | 'afternoon' | 'evening' | 'night', { start: number; end: number }> = {
  morning: { start: 5, end: 12 },
  afternoon: { start: 12, end: 17 },
  evening: { start: 17, end: 21 },
  night: { start: 21, end: 5 },
};

export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / KM_PER_DEG_LAT;
  const cos = Math.cos((lat * Math.PI) / 180);
  const lngDelta = radiusKm / (KM_PER_DEG_LAT * (Math.abs(cos) < 1e-6 ? 1e-6 : cos));
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}

export function offsetByKm(lat: number, lng: number, km: number, bearingDeg: number) {
  const earthKm = 6371;
  const br = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lng1 = (lng * Math.PI) / 180;
  const ang = km / earthKm;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(ang) + Math.cos(lat1) * Math.sin(ang) * Math.cos(br));
  const lng2 =
    lng1 + Math.atan2(Math.sin(br) * Math.sin(ang) * Math.cos(lat1), Math.cos(ang) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lng2 * 180) / Math.PI };
}

export function adjustedDistanceKm(
  rawKm: number,
  precision: 'EXACT' | 'AREA',
  areaRadiusKm: number | null,
): number {
  if (precision !== 'AREA' || areaRadiusKm == null) return rawKm;
  return Math.max(0, rawKm - areaRadiusKm);
}

export function distanceBand(km: number): DistanceBand {
  if (km <= 2) return 'LE_2';
  if (km <= 5) return 'LE_5';
  if (km <= 10) return 'LE_10';
  if (km <= 25) return 'LE_25';
  return 'GT_25';
}

/** Radii to try: the requested value, then ladder rungs strictly above it (max 50 km). */
export function expandRadii(requestedKm: number, autoExpand: boolean): number[] {
  const clamped = Math.min(50, Math.max(0.5, requestedKm));
  if (!autoExpand) return [clamped];
  const rest = RADIUS_LADDER_KM.filter((rung) => rung > clamped + 1e-9);
  return [clamped, ...rest];
}

export function recommendationScore(input: {
  favouriteSport: boolean;
  viewerSkill: SkillLevel | null;
  sessionSkill: SkillLevel | null;
  distanceKm: number;
  radiusKm: number;
  hoursUntilStart: number;
  venueConfirmed: boolean;
}): number {
  const favourite = input.favouriteSport ? 1 : 0;
  let skill = 0.5;
  if (input.sessionSkill && input.viewerSkill) {
    skill = input.sessionSkill === input.viewerSkill ? 1 : 0;
  }
  const proximity = 1 - Math.min(input.distanceKm, input.radiusKm) / Math.max(input.radiusKm, 0.5);
  const soonness = 1 - Math.min(Math.max(input.hoursUntilStart, 0), 14 * 24) / (14 * 24);
  const venue = input.venueConfirmed ? 1 : 0;
  return (
    RECOMMENDATION_WEIGHTS.favouriteSport * favourite +
    RECOMMENDATION_WEIGHTS.skillMatch * skill +
    RECOMMENDATION_WEIGHTS.proximity * proximity +
    RECOMMENDATION_WEIGHTS.soonness * soonness +
    RECOMMENDATION_WEIGHTS.venueConfirmed * venue
  );
}

export function dubaiHour(date: Date): number {
  const shifted = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  return shifted.getUTCHours();
}

export function hourInTimeOfDay(hour: number, slot: keyof typeof TIME_OF_DAY_HOURS): boolean {
  const { start, end } = TIME_OF_DAY_HOURS[slot];
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}
