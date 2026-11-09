// Sport limits are placeholder seed values pending confirmation (docs/database/schema.md §5).
export const SEED_SPORTS = [
  {
    slug: 'badminton',
    name: 'Badminton',
    iconKey: 'badminton',
    accentColor: '#14B8A6',
    minPlayers: 2,
    maxPlayers: 8,
    defaultPlayers: 4,
    sortOrder: 1,
  },
  {
    slug: 'football',
    name: 'Football',
    iconKey: 'football',
    accentColor: '#34C759',
    minPlayers: 6,
    maxPlayers: 22,
    defaultPlayers: 10,
    sortOrder: 2,
  },
  {
    slug: 'cricket',
    name: 'Cricket',
    iconKey: 'cricket',
    accentColor: '#F59E0B',
    minPlayers: 6,
    maxPlayers: 22,
    defaultPlayers: 12,
    sortOrder: 3,
  },
];

type SeedVenue = {
  googlePlaceId: string;
  name: string;
  addressLine: string;
  area: string;
  city: string;
  latitude: number;
  longitude: number;
  sports: string[];
};

function venue(
  key: string,
  name: string,
  area: string,
  city: string,
  latitude: number,
  longitude: number,
  sports: string[],
): SeedVenue {
  return {
    googlePlaceId: `seed-venue-${key}`,
    name,
    addressLine: `${name}, ${area}`,
    area,
    city,
    latitude,
    longitude,
    sports,
  };
}

// Fictional development venues placed at real UAE area coordinates. Not real businesses.
export const SEED_VENUES: SeedVenue[] = [
  venue('marina', 'Marina Sports Hub', 'Dubai Marina', 'Dubai', 25.0805, 55.1403, ['badminton', 'football']),
  venue('jlt', 'Lakes Court Centre', 'Jumeirah Lake Towers', 'Dubai', 25.0693, 55.1413, ['badminton']),
  venue('barsha', 'Barsha Turf Park', 'Al Barsha', 'Dubai', 25.1135, 55.2004, ['football', 'cricket']),
  venue('quoz', 'Quoz Indoor Arena', 'Al Quoz', 'Dubai', 25.1375, 55.2391, ['badminton', 'football']),
  venue('bay', 'Business Bay Courts', 'Business Bay', 'Dubai', 25.1866, 55.2633, ['badminton']),
  venue('dso', 'Oasis Cricket Nets', 'Dubai Silicon Oasis', 'Dubai', 25.1185, 55.378, ['cricket']),
  venue('mirdif', 'Mirdif Community Pitch', 'Mirdif', 'Dubai', 25.2196, 55.4196, ['football']),
  venue('majaz', 'Majaz Sports Club', 'Al Majaz', 'Sharjah', 25.326, 55.387, ['badminton', 'cricket']),
  venue('khalifa', 'Khalifa City Grounds', 'Khalifa City', 'Abu Dhabi', 24.4199, 54.5786, ['cricket', 'football']),
  venue('reem', 'Reem Island Courts', 'Al Reem Island', 'Abu Dhabi', 24.4967, 54.4067, ['badminton']),
];
