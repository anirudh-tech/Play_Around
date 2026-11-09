> ⚠️ **SUPERSEDED — historical reference only.** Archived 8 Nov 2026.
> Kept because it lists the checkout, provider-notification, payout and finance-admin endpoints planned for online payments. **Do not implement from this file.**
> Current API: [api/api-specification.md](../api/api-specification.md).

# API Contracts (v1)

Base URL `/api/v1`. JSON. Every request/response schema lives in `packages/contracts` (Zod), and the OpenAPI document served at `/docs` is generated from it. Mobile, web and admin use only these endpoints.

## 1. Conventions

```json
// success
{ "data": { }, "meta": { "nextCursor": "…" } }
// error
{ "error": { "code": "SESSION_FULL", "message": "No spots left.", "details": null, "requestId": "…" } }
```

| HTTP | Codes |
| --- | --- |
| 400 | `VALIDATION_ERROR` |
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSED`, `MFA_REQUIRED` |
| 403 | `FORBIDDEN`, `NOT_ORGANISER`, `EMAIL_NOT_VERIFIED`, `REMOVED_BY_ORGANISER`, `PAYOUT_ACCOUNT_REQUIRED`, `ACCOUNT_SUSPENDED` |
| 404 | `NOT_FOUND` |
| 409 | `SESSION_FULL`, `SESSION_NOT_OPEN`, `SESSION_STARTED`, `ALREADY_JOINED`, `NOT_A_PARTICIPANT`, `VENUE_NOT_CONFIRMED`, `VENUE_ALREADY_CONFIRMED`, `PRICE_LOCKED`, `CAPACITY_BELOW_TAKEN`, `RESERVATION_EXPIRED`, `PAYMENT_IN_PROGRESS`, `INVALID_STATE_TRANSITION`, `IDEMPOTENCY_KEY_REUSED`, `EMAIL_TAKEN` |
| 422 | `REFUND_NOT_ALLOWED` |
| 429 | `RATE_LIMITED` |
| 502 | `PAYMENT_PROVIDER_ERROR` |

- Auth: `Authorization: Bearer <access>`. Web/admin refresh via httpOnly cookie; mobile via body.
- `X-Client: ios|android|web|admin` and `X-App-Version`; the API can return `426 UPGRADE_REQUIRED`.
- Cursor pagination everywhere (`limit` ≤ 50).
- Money: `{ "amountMinor": 3000, "currency": "AED" }`. Dates: ISO-8601 UTC + `timezone` on sessions.
- **`Idempotency-Key` header required** on: `POST /sessions`, `POST /sessions/:id/join`, `POST /payments/:id/checkout`, `POST /sessions/:id/leave`, and all admin money actions.

Access legend: 🔓 public · 🔐 signed in · ✉️ signed in + verified email · 👑 organiser of the session · 🛡 staff (role noted)

## 2. Endpoints

### Auth
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | 🔓 | `{ email, password, displayName }` |
| POST | `/auth/login` | 🔓 | → `{ accessToken, refreshToken?, user }` |
| POST | `/auth/refresh` | 🔓 | rotation with reuse detection |
| POST | `/auth/logout` · `/auth/logout-all` | 🔐 | |
| POST | `/auth/verify-email` · `/auth/verify-email/resend` | 🔐 | |
| POST | `/auth/forgot-password` · `/auth/reset-password` | 🔓 | always 202 on forgot |

### Users
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET / PATCH | `/users/me` | 🔐 | profile, radius, home area, notification prefs |
| PUT | `/users/me/favourite-sports` | 🔐 | `[{ sportId, skillLevel }]` |
| POST / DELETE | `/users/me/devices` · `/users/me/devices/:pushToken` | 🔐 | push tokens |
| DELETE | `/users/me` | 🔐 | blocked while active sessions, payments or payouts are unsettled (`409` with reasons) |
| GET | `/users/:id` · `/users/:id/reviews` | 🔐 | public profile |

### Sports and venues
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/sports` | 🔓 | cacheable |
| GET | `/venues?q=&sportId=&city=` | 🔐 | search |
| GET | `/venues/nearby?lat&lng&radiusKm&sportId` | 🔐 | |
| GET | `/venues/:id` | 🔐 | + upcoming open sessions |
| POST | `/venues` | ✉️ | dedupe by `googlePlaceId` |

### Discovery
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/sessions/nearby` | 🔐 | see §3.1 |

### Sessions
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/sessions` | ✉️ | both types, see §3.2. Paid sessions need an `ACTIVE` payout account. |
| GET | `/sessions/:id` | 🔓 limited / 🔐 full | public view powers share links |
| PATCH | `/sessions/:id` | 👑 | editing rules per [lifecycle §5](../architecture/02-session-lifecycle.md#5-editing-rules) |
| POST | `/sessions/:id/confirm-venue` | 👑 | LFP only, see §3.3 |
| POST | `/sessions/:id/cancel` | 👑 | `{ note? }` → refunds everyone |
| GET | `/sessions/:id/price-preview` | 🔐 | share, fee, total for the viewer |
| GET | `/me/sessions?role=organised\|joined\|interested&bucket=upcoming\|completed\|cancelled` | 🔐 | My Activities |

### Participants
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST / DELETE | `/sessions/:id/interest` | 🔐 | LFP only; no spot held |
| POST | `/sessions/:id/join` | ✉️ | reserves/holds a spot; returns `{ participant, payment? }`, see §3.4 |
| POST | `/sessions/:id/leave` | 🔐 | returns the refund outcome |
| GET | `/sessions/:id/leave-preview` | 🔐 | refund the player would get (policy engine) |
| GET | `/sessions/:id/participants` | 🔐 | confirmed + held (names, avatars); organiser also sees pending |
| DELETE | `/sessions/:id/participants/:userId` | 👑 | remove → full refund |

### Payments (player)
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/payments/:id/checkout` | 🔐 | create or resume checkout for a reserved spot (also starts payment for LFP `HELD` after confirmation) |
| POST | `/sessions/:id/pay` | 🔐 | convenience for LFP holders: reserve + create payment in one step |
| GET | `/payments/:id` | 🔐 owner | status polling after returning from checkout |
| POST | `/payments/:id/cancel` | 🔐 owner | abandon checkout; releases reservation (EXISTING_BOOKING) or returns to `HELD` (LFP) |
| GET | `/me/payments` | 🔐 | history: payments with their refunds |

### Payouts (organiser)
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/me/payout-account` | 🔐 | status + requirements |
| POST | `/me/payout-account` | ✉️ | create provider account → `{ onboardingUrl }` |
| POST | `/me/payout-account/onboarding-link` | 🔐 | refresh expired link |
| GET | `/me/payouts` | 🔐 | earnings per session, status, expected date |

### Webhooks
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/webhooks/payments/:provider` | signature | raw body; 200 for valid (including duplicates), 400 for invalid signature |

### Notifications
| Method | Path | Access |
| --- | --- | --- |
| GET | `/notifications?unreadOnly=` | 🔐 |
| GET | `/notifications/unread-count` | 🔐 |
| PATCH | `/notifications/:id/read` | 🔐 owner |
| POST | `/notifications/read-all` | 🔐 |

### Reviews, reports, uploads, health
| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/sessions/:id/reviews` | 🔐 | confirmed co-participants of COMPLETED sessions, ≤ 7 days |
| POST | `/reports` | 🔐 | `{ targetType, targetId, reason, details }`. A session report blocks its payout until resolved. |
| POST | `/uploads/sign` | 🔐 | `{ purpose: avatar \| session_image \| venue_image }` |
| GET | `/health` · `/health/ready` | 🔓 | |

### Admin (`/admin/*`, staff only, MFA, audited)
| Method | Path | Role |
| --- | --- | --- |
| POST | `/admin/auth/session` | staff (password + TOTP) |
| GET | `/admin/metrics/overview` | any staff |
| GET | `/admin/users` · `/admin/users/:id` | any staff |
| POST | `/admin/users/:id/suspend` · `/reactivate` | OPERATIONS |
| PATCH | `/admin/users/:id/role` | SUPER_ADMIN |
| GET | `/admin/sessions` · `/admin/sessions/:id` (incl. timeline) | any staff |
| POST | `/admin/sessions/:id/cancel` | OPERATIONS |
| DELETE | `/admin/sessions/:id/participants/:userId` | SUPPORT |
| GET / POST / PATCH | `/admin/sports` · `/admin/sports/:id` | OPERATIONS |
| GET / PATCH | `/admin/venues` · `/admin/venues/:id` | OPERATIONS |
| POST | `/admin/venues/:id/merge` `{ intoVenueId }` | OPERATIONS |
| GET | `/admin/payments` · `/admin/payments/:id` (ledger, refunds, events) | FINANCE |
| POST | `/admin/payments/:id/refunds` `{ amountMinor, reason, note }` | FINANCE |
| POST | `/admin/refunds/:id/retry` | FINANCE |
| GET | `/admin/webhook-events` · `/admin/webhook-events/:id` | FINANCE |
| POST | `/admin/webhook-events/:id/replay` | FINANCE |
| GET | `/admin/payouts` | FINANCE |
| POST | `/admin/payouts/:id/hold` · `/release` · `/cancel` | FINANCE |
| GET / PATCH | `/admin/reports` · `/admin/reports/:id` | SUPPORT |
| PATCH | `/admin/reviews/:id` `{ isHidden }` | SUPPORT |
| GET / PUT | `/admin/settings` · `/admin/settings/:key` | SUPER_ADMIN |
| GET | `/admin/audit-logs` | SUPER_ADMIN |

## 3. Key payloads

### 3.1 `GET /sessions/nearby`

| Param | Default | Notes |
| --- | --- | --- |
| `lat`, `lng` | required | GPS or manually selected point |
| `radiusKm` | user default (5) | 0.5–50 |
| `autoExpand` | `true` | 2 → 5 → 10 → 25 → 50 |
| `sportIds` | all | csv |
| `types` | both | `EXISTING_BOOKING,LOOKING_FOR_PLAYERS` |
| `venueConfirmedOnly` | `false` | |
| `from`, `to` | now → +14 d | |
| `timeOfDay` | — | `morning,afternoon,evening,night` (venue local time) |
| `minPriceMinor`, `maxPriceMinor` | — | per-player (estimated for unconfirmed) |
| `minSpots` | 1 | |
| `skillLevel` | — | |
| `sort` | `distance` | `soonest`, `price`, `recommended` |
| `limit`, `cursor` | 20 | |

`SessionSummary` (used by cards, details header and socket patches):

```json
{
  "id": "…",
  "type": "LOOKING_FOR_PLAYERS",
  "status": "OPEN",
  "venueConfirmationStatus": "PENDING",
  "sport": { "id": 2, "slug": "football", "name": "Football", "accentColor": "#34C759" },
  "location": {
    "precision": "AREA",
    "label": "JLT, Dubai",
    "latitude": 25.0693, "longitude": 55.1413,
    "areaRadiusKm": 3,
    "venue": null
  },
  "startsAt": "2026-11-12T16:00:00.000Z",
  "endsAt": "2026-11-12T17:30:00.000Z",
  "timezone": "Asia/Dubai",
  "venueConfirmDeadline": "2026-11-12T04:00:00.000Z",
  "capacity": 10,
  "confirmedCount": 1,
  "reservedCount": 4,
  "interestedCount": 6,
  "spotsLeft": 5,
  "price": {
    "isEstimate": true,
    "perPlayer": { "amountMinor": 4000, "currency": "AED" },
    "serviceFee": { "amountMinor": 200, "currency": "AED" },
    "total": { "amountMinor": 40000, "currency": "AED" }
  },
  "skillLevel": null,
  "organiser": { "id": "…", "displayName": "Ravi S.", "avatarUrl": "…", "ratingAvg": 4.7 },
  "participantPreview": [{ "id": "…", "avatarUrl": "…" }],
  "distanceKm": 1.9,
  "band": "LE_2",
  "viewer": { "participantStatus": "INTERESTED", "paymentId": null, "reservedUntil": null, "paymentDueAt": null },
  "version": 7
}
```

### 3.2 `POST /sessions`

```json
// EXISTING_BOOKING
{
  "type": "EXISTING_BOOKING",
  "sportId": 1,
  "venue": { "venueId": "…" },                       // or { "newVenue": { …POST /venues body } }
  "startsAt": "…", "endsAt": "…",
  "capacity": 4,
  "organiserIsPlaying": true,
  "totalCostMinor": 12000,
  "bookingReference": "DSC-88213",                   // optional, shown to admin only
  "skillLevel": "INTERMEDIATE",
  "title": "Evening doubles", "instructions": "Court 3", "imageKeys": []
}

// LOOKING_FOR_PLAYERS
{
  "type": "LOOKING_FOR_PLAYERS",
  "sportId": 2,
  "preferredArea": { "label": "JLT, Dubai", "latitude": 25.0693, "longitude": 55.1413, "radiusKm": 3, "googlePlaceId": "…" },
  "startsAt": "…", "endsAt": "…",
  "venueConfirmDeadline": "…",                       // optional; default starts_at − 12 h
  "capacity": 10,
  "organiserIsPlaying": true,
  "estimatedTotalCostMinor": 40000,
  "instructions": "Looking for a 5-a-side pitch around JLT"
}
```

The server computes `status`, `venueConfirmationStatus`, counters, the per-player cost and fee snapshot, coordinates, timezone and `locationPrecision`. The strict schema rejects any of these if the client sends them.

Validation: capacity within the sport's min/max; start ≥ 30 min ahead (LFP ≥ 3 h, to leave time to confirm and collect) and ≤ 60 days; duration 30 min–6 h; cost 0–1,000,000 fils; at most 10 upcoming organised sessions.

### 3.3 `POST /sessions/:id/confirm-venue`

```json
{
  "venue": { "venueId": "…" },
  "startsAt": "…", "endsAt": "…",
  "totalCostMinor": 36000,
  "bookingReference": "…"
}
```

→ updated `SessionSummary`. Holders receive `PAYMENT_DUE` notifications with `paymentDueAt`.

### 3.4 `POST /sessions/:id/join`

```json
// 201 — paid, venue confirmed
{
  "participant": { "status": "PENDING_PAYMENT", "reservedUntil": "2026-11-10T14:15:00.000Z" },
  "payment": { "id": "…", "status": "PENDING", "amount": { "amountMinor": 3200, "currency": "AED" },
               "checkoutUrl": "https://checkout.provider/…", "expiresAt": "…" }
}
// 201 — LFP before confirmation
{ "participant": { "status": "HELD", "paymentDueAt": null }, "payment": null }
// 201 — free session
{ "participant": { "status": "CONFIRMED" }, "payment": null }
```

### 3.5 `GET /payments/:id`

```json
{
  "id": "…", "status": "SUCCEEDED",
  "amount": { "amountMinor": 3200, "currency": "AED" },
  "share": { "amountMinor": 3000, "currency": "AED" },
  "serviceFee": { "amountMinor": 200, "currency": "AED" },
  "participantStatus": "CONFIRMED",
  "session": { "id": "…", "title": "…", "startsAt": "…" },
  "refunds": [],
  "createdAt": "…", "succeededAt": "…"
}
```

## 4. Socket.IO contract

Handshake `auth: { token }` (optional for public rooms).

| Dir | Event | Payload |
| --- | --- | --- |
| C→S | `session:subscribe` / `session:unsubscribe` | `{ ids: string[] }` (≤ 50) |
| S→C | `session:availability` | `{ id, status, confirmedCount, reservedCount, interestedCount, spotsLeft, version }` |
| S→C | `session:status` | `{ id, status, venueConfirmationStatus, cancellationReason?, version }` |
| S→C | `session:updated` | `{ id, changedFields[], version }`; client refetches the detail |
| S→C | `session:venue_confirmed` | `{ id, location, price, startsAt, endsAt, version }` |
| S→C | `session:participant_joined` / `_left` | `{ sessionId, user?, userId, version }` |
| S→C | `payment:updated` (user room) | `{ paymentId, sessionId, status, participantStatus }` |
| S→C | `participant:updated` (user room) | `{ sessionId, status, reservedUntil?, paymentDueAt? }` |
| S→C | `notification:new` / `notification:unread_count` | `Notification` / `{ count }` |
| S→C | `admin:feed` (admin room) | `{ kind, refId, summary }` |

## 5. Rate limits

| Scope | Limit |
| --- | --- |
| login/register | 10 / 15 min per IP + per email |
| forgot/resend | 3 / h per account |
| `/sessions/nearby` | 60 / min per user |
| `POST /sessions` | 20 / day per user |
| join / leave / checkout | 30 / min per user; max 3 concurrent `PENDING_PAYMENT` reservations per user |
| webhooks | 600 / min per provider IP range (no auth) |
| admin | 120 / min per staff user |
| default | 300 / min per user |
