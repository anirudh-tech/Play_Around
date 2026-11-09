/** Default discover pin when GPS is denied (Dubai Marina). Not a stored user location. */
export const DEFAULT_MAP_CENTER = {
  lat: 25.0772,
  lng: 55.139,
  label: 'Dubai Marina',
} as const;

export const BAND_LABELS: Record<string, string> = {
  LE_2: 'Within 2 km',
  LE_5: 'Within 5 km',
  LE_10: 'Within 10 km',
  LE_25: 'Within 25 km',
  GT_25: 'Further away',
};
