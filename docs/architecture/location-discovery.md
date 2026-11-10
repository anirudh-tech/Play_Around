# Location-Based Discovery

GPS and manual location are both supported (DEC-009). The approach is ARC-005. The endpoint contract is in [API specification §3.1](../api/api-specification.md#31-get-sessionsnearby).

## 1. Where coordinates live

| Data | Stored | Precision | Visibility |
| --- | --- | --- | --- |
| Venue | `venues.latitude/longitude` `DECIMAL(9,6)` | exact | public |
| `EXISTING_BOOKING` session / confirmed `LOOKING_FOR_PLAYERS` session | `sessions.latitude/longitude` copied from venue; `location_precision = EXACT` | exact | public |
| Unconfirmed `LOOKING_FOR_PLAYERS` session | `sessions.latitude/longitude` = centroid of the chosen **preferred area** (from Places), `area_radius_km` (default 3), `location_precision = AREA` | area | public (it's an area, not a person's location) |
| User's current position | **Not stored.** Sent per request as query params | — | never exposed |
| User's saved home area (optional) | label + coordinates rounded to 2 dp (~1 km) | coarse | private to the user; never returned by any other endpoint |

Request coordinates are redacted from logs. Session responses include only venue/area coordinates.

## 2. Query strategy

One table (`sessions`), two stages:

1. **Indexed bounding box**: from `(lat, lng, radiusKm)`:
   `Δlat = r / 111.045`, `Δlng = r / (111.045 · cos(lat))`.
   Uses `sessions (status, starts_at)` and `(latitude, longitude)` indexes. Discovery always filters on `status = 'OPEN' AND starts_at > now`, so the candidate set is small and time-bounded.
2. **Exact distance**: spherical Haversine on `latitude`/`longitude` (metres), then filtered by radius and sorted.

```sql
SELECT s.*, (
  6371000 * acos(LEAST(1, GREATEST(-1,
    cos(radians(:lat)) * cos(radians(s.latitude::float)) * cos(radians(s.longitude::float) - radians(:lng))
    + sin(radians(:lat)) * sin(radians(s.latitude::float))
  )))
) AS distance_m
FROM sessions s
WHERE s.status::text = 'OPEN'
  AND s.visibility::text = 'PUBLIC'
  AND s.starts_at > now()
  AND s.latitude  BETWEEN :minLat AND :maxLat
  AND s.longitude BETWEEN :minLng AND :maxLng
  AND s.sport_id IN (:sportIds)                      -- optional
  AND s.session_type::text IN (:types)               -- optional
  AND s.starts_at BETWEEN :from AND :to              -- optional
  AND COALESCE(s.share_max_fils, s.estimated_share_max_fils, 0) BETWEEN :minPriceFils AND :maxPriceFils   -- optional
  AND (s.capacity - s.confirmed_count) >= :minSpots
  AND (:joinableOnly = false OR s.venue_confirmation_status::text = 'CONFIRMED')
  AND (
    6371000 * acos(...)  -- same expression as distance_m
  ) <= :radiusM
ORDER BY distance_m, s.starts_at, s.id
LIMIT :limit;
```

This is run with `prisma.$queryRaw` (parameterised) in `discovery.repository.ts`.

**Joinability:** `FULL` sessions are excluded, so every result has a free spot.
- `LOOKING_FOR_PLAYERS` sessions with venue `PENDING` are **shown but not joinable** (DEC-028).
- Their cards say "Venue being arranged", show an estimated price and offer "I'm interested" (pending O-01) instead of "Join".
- `joinableOnly=true` hides them.

**Price filter:** uses the largest per-player share (`share_max_fils`, or the estimate while the venue is pending). Free sessions have price 0. Organisers are paid directly; cards show the pay-the-organiser notice (DEC-012).

**Area sessions:** for `location_precision = AREA`, the reported distance is `max(0, distance_to_centroid − area_radius)`, labelled "~2 km away", so area sessions aren't unfairly ranked below exact ones.

### Why not a SPATIAL index in MVP
Prisma has no native `POINT` type. **Upgrade path, with no API change:** enable PostGIS, add a `geography` column + GIST index, and switch stage 1 to `ST_DWithin`. The trigger is a discovery p95 above 300 ms in load tests.

## 3. Radius, bands and auto-expansion

- Default radius: **5 km** (user setting; admin can change the platform default). Range 0.5–50 km.
- Each result has `distanceKm` and `band` ∈ `LE_2`, `LE_5`, `LE_10`, `LE_25`, `GT_25`. Lists are grouped by band.
- `autoExpand=true` (default on Discover): if fewer than `minResults` (5) are found, the server retries up the ladder **2 → 5 → 10 → 25 → 50 km** and reports the radius actually used:

```json
"meta": { "requestedRadiusKm": 5, "radiusUsedKm": 25, "expanded": true, "nextCursor": "…" }
```

The UI shows: *"Not much nearby — showing games within 25 km."*

## 4. Sorting and pagination

| `sort` | Order | Cursor |
| --- | --- | --- |
| `distance` (default) | distance, startsAt, id | `(distanceM, id)` |
| `soonest` | startsAt, distance, id | `(startsAt, id)` |
| `price` | largest per-player share (fils), distance, id | `(priceFils, id)` |
| `recommended` | score desc, id | offset within the radius (bounded result set) |

Recommendation score (v1, rule-based, weights in `platform_settings`):
`0.35·favouriteSport + 0.20·skillMatch + 0.25·proximity + 0.15·soonness + 0.05·venueConfirmed`.

## 5. Client location flow

1. Explain the benefit, then request permission (`expo-location` / browser Geolocation).
2. Granted → current position (balanced accuracy, cached 5 min); "Use current location" stays available in the selector.
3. Denied/unavailable → **LocationSelector**: Places Autocomplete limited to regions/areas, recent areas, and a map pin drop. The chosen point becomes the search origin.
4. The origin lives in a persisted Zustand store on the device and is sent only as query params.

## 6. Map view

- Same endpoint with the map centre and a radius derived from the visible bounds (debounced 400 ms on mobile; "Search this area" button on web).
- EXACT sessions → pin coloured by sport accent with a spots-left badge. AREA sessions → translucent circle with a "Venue TBC" badge.
- Clustering when more than ~100 markers are in view.

## 7. Venue search for organisers

- `GET /venues/nearby` and `GET /venues?q=` search our venues first. Google Places is the fallback; a new venue is created on first use and deduplicated by `google_place_id`.
- Preferred area for LOOKING_FOR_PLAYERS: Places Autocomplete restricted to areas (`sublocality`, `neighborhood`, `locality`), storing the label, centroid and an optional radius.

## 8. Tests

- Unit: bounding-box maths at 0°, 25°N (Dubai) and 60°N; area-distance adjustment.
- Integration: seeded sessions at 0.8, 3, 7, 15 and 40 km from a Dubai Marina origin verify bands, ordering, filters, auto-expansion and that FULL/past/cancelled sessions never appear.
- Integration: pending LFP sessions appear with `joinable: false` and disappear with `joinableOnly=true`; staff-only venue fields never appear in results.
