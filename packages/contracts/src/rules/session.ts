import { PLATFORM_SETTING_DEFAULTS } from '../settings';
import { minShare } from './split';

const MIN_DURATION_MS = 30 * 60 * 1000;
const MAX_DURATION_MS = 6 * 60 * 60 * 1000;
const MAX_START_AHEAD_MS = 60 * 24 * 60 * 60 * 1000;

export interface SportLimits {
  minPlayers: number;
  maxPlayers: number;
}

export function assertLeadTime(startsAt: Date, now: Date, hours = PLATFORM_SETTING_DEFAULTS['sessions.min_lead_time_hours']) {
  if (startsAt.getTime() < now.getTime() + hours * 60 * 60 * 1000) {
    throw new Error('LEAD_TIME_TOO_SHORT');
  }
  if (startsAt.getTime() > now.getTime() + MAX_START_AHEAD_MS) {
    throw new Error('LEAD_TIME_TOO_SHORT');
  }
}

export function assertDuration(startsAt: Date, endsAt: Date) {
  const ms = endsAt.getTime() - startsAt.getTime();
  if (ms < MIN_DURATION_MS || ms > MAX_DURATION_MS) {
    throw new Error('DURATION_INVALID');
  }
}

export function assertCapacity(sport: SportLimits, capacity: number, minPlayers: number | null) {
  if (capacity < sport.minPlayers || capacity > sport.maxPlayers) {
    throw new Error('CAPACITY_OUT_OF_RANGE');
  }
  if (minPlayers != null && (minPlayers < sport.minPlayers || minPlayers > capacity)) {
    throw new Error('MIN_PLAYERS_BELOW_SPORT_MIN');
  }
}

export function assertPaidShare(totalFils: number, capacity: number, minShareFils: number) {
  if (totalFils === 0) return;
  if (minShare(totalFils, capacity) < minShareFils) {
    throw new Error('SHARE_BELOW_MINIMUM');
  }
}

export function isJoinable(input: {
  status: string;
  venueConfirmationStatus: string;
  startsAt: Date;
  now: Date;
}): boolean {
  return (
    input.status === 'OPEN' &&
    input.venueConfirmationStatus === 'CONFIRMED' &&
    input.now < input.startsAt
  );
}

export function priceIncreasePercent(previous: number, next: number): number {
  if (previous <= 0) return next > 0 ? 100 : 0;
  return ((next - previous) / previous) * 100;
}
