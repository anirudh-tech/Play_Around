import { describe, expect, it } from 'vitest';
import {
  adjustedDistanceKm,
  boundingBox,
  distanceBand,
  expandRadii,
  hourInTimeOfDay,
  KM_PER_DEG_LAT,
  offsetByKm,
  recommendationScore,
} from './discovery';

describe('boundingBox', () => {
  it('uses 111.045 km per degree at the equator', () => {
    const box = boundingBox(0, 0, 1);
    expect(box.maxLat - box.minLat).toBeCloseTo(2 / KM_PER_DEG_LAT, 8);
    expect(box.maxLng - box.minLng).toBeCloseTo(2 / KM_PER_DEG_LAT, 8);
  });

  it('widens longitude at 25°N (Dubai) and 60°N', () => {
    const dubai = boundingBox(25, 55, 5);
    const north = boundingBox(60, 55, 5);
    const equator = boundingBox(0, 55, 5);
    expect(dubai.maxLng - dubai.minLng).toBeGreaterThan(equator.maxLng - equator.minLng);
    expect(north.maxLng - north.minLng).toBeGreaterThan(dubai.maxLng - dubai.minLng);
    expect(dubai.maxLat - dubai.minLat).toBeCloseTo(equator.maxLat - equator.minLat, 8);
  });
});

describe('adjustedDistanceKm', () => {
  it('subtracts the area radius and floors at 0', () => {
    expect(adjustedDistanceKm(4, 'AREA', 3)).toBeCloseTo(1);
    expect(adjustedDistanceKm(2, 'AREA', 3)).toBe(0);
    expect(adjustedDistanceKm(4, 'EXACT', 3)).toBe(4);
  });
});

describe('distanceBand', () => {
  it('maps the documented thresholds', () => {
    expect(distanceBand(0.8)).toBe('LE_2');
    expect(distanceBand(3)).toBe('LE_5');
    expect(distanceBand(7)).toBe('LE_10');
    expect(distanceBand(15)).toBe('LE_25');
    expect(distanceBand(40)).toBe('GT_25');
  });
});

describe('expandRadii', () => {
  it('starts at the requested radius then climbs the ladder', () => {
    expect(expandRadii(5, true)).toEqual([5, 10, 25, 50]);
    expect(expandRadii(5, false)).toEqual([5]);
    expect(expandRadii(3, true)).toEqual([3, 5, 10, 25, 50]);
  });
});

describe('recommendationScore', () => {
  it('ranks a favourite nearby confirmed session above a far mismatch', () => {
    const close = recommendationScore({
      favouriteSport: true,
      viewerSkill: 'INTERMEDIATE',
      sessionSkill: 'INTERMEDIATE',
      distanceKm: 1,
      radiusKm: 5,
      hoursUntilStart: 4,
      venueConfirmed: true,
    });
    const far = recommendationScore({
      favouriteSport: false,
      viewerSkill: 'INTERMEDIATE',
      sessionSkill: 'PROFESSIONAL',
      distanceKm: 40,
      radiusKm: 5,
      hoursUntilStart: 200,
      venueConfirmed: false,
    });
    expect(close).toBeGreaterThan(far);
  });
});

describe('hourInTimeOfDay', () => {
  it('wraps night across midnight', () => {
    expect(hourInTimeOfDay(22, 'night')).toBe(true);
    expect(hourInTimeOfDay(3, 'night')).toBe(true);
    expect(hourInTimeOfDay(10, 'night')).toBe(false);
    expect(hourInTimeOfDay(10, 'morning')).toBe(true);
  });
});

describe('offsetByKm', () => {
  it('moves ~1 km north', () => {
    const point = offsetByKm(25.0805, 55.1403, 1, 0);
    expect(point.latitude).toBeGreaterThan(25.0805);
    expect(point.longitude).toBeCloseTo(55.1403, 3);
  });
});
