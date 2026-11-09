# API Specification (MVP v1)

Base URL `/api/v1`, JSON. Every request and response schema lives in `packages/contracts` (Zod). The OpenAPI document served at `/docs` is generated from those schemas. Mobile, web and admin use only these endpoints.

**The MVP has no Stripe, checkout, payout or provider-webhook endpoints** (DEC-017, DEC-021). Their earlier design is in [archive/api-contracts-v2-online-payments.md](../archive/api-contracts-v2-online-payments.md) and [future/online-payments-stripe.md](../future/online-payments-stripe.md).

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
| 401 | `UNAUTHENTICATED`, `TOKEN_EXPIRED`, `REFRESH_TOKEN_REUSED`, `MFA_REQUIRED`, `MFA_INVALID` |
| 403 | `FORBIDDEN`, `NOT_ORGANISER`, `EMAIL_NOT_VERIFIED`, `PHONE_NOT_VERIFIED`, `REMOVED_BY_ORGANISER`, `ACCOUNT_SUSPENDED`, `STAFF_ROLE_REQUIRED` |
| 404 | `NOT_FOUND` |
| 409 | `SESSION_FULL`, `SESSION_NOT_OPEN`, `SESSION_STARTED`, `SESSION_NOT_JOINABLE`, `ALREADY_JOINED`, `NOT_A_PARTICIPANT`, `VENUE_NOT_CONFIRMED`, `VENUE_ALREADY_CONFIRMED`, `CAPACITY_BELOW_CONFIRMED`, `ORGANISER_LIMIT_REACHED`, `LEAD_TIME_TOO_SHORT`, `MIN_PLAYERS_BELOW_SPORT_MIN`, `SHARE_BELOW_MINIMUM`, `PRICE_CONSENT_PENDING`, `INVALID_STATE_TRANSITION`, `DISPUTE_ALREADY_OPEN`, `VERSION_CONFLICT`, `IDEMPOTENCY_KEY_REUSED`, `EMAIL_TAKEN`, `PHONE_TAKEN`, `IDENTITY_ALREADY_LINKED` |
| 422 | `REFUND_EXCEEDS_PAID`, `DEADLINE_PASSED` |
| 429 | `RATE_LIMITED` |

- **Auth:** `Authorization: Bearer <access>`. Web and admin send the refresh token in an httpOnly cookie; mobile sends it in the body ([authentication](../workflows/authentication.md)).
- **Client headers:** `X-Client: ios|android|web|admin` and `X-App-Version`. The API can return `426 UPGRADE_REQUIRED`.
- **Pagination:** cursor-based everywhere (`limit` ≤ 50).
- **Money:** `{ "amountFils": 3334, "currency": "AED" }`. Dates are ISO-8601 UTC, and sessions also carry `timezone`.
- **Optimistic concurrency:** session and payment mutations accept `expectedVersion` and return `409 VERSION_CONFLICT` if it's stale.
- **`Idempotency-Key` header required on:** `POST /sessions`, join, leave, every payment action, every venue option or booking action, and every admin mutation.

Access legend:
- 🔓 public
- 🔐 signed in
- ✉️ signed in with verified email
- 📱 signed in with verified email and verified phone
- 👑 organiser of the session
- 🎟 participant of the session
- 🛡 staff (role noted; TOTP session required)

## 2. Endpoints

### Auth

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | 🔓 | `{ email, password, displayName }`. Password ≥ 10 characters. |
| POST | `/auth/login` | 🔓 | Returns `{ accessToken, refreshToken?, user }` |
| POST | `/auth/google` | 🔓 | `{ idToken }`. Signs in or creates an account. Linking rules are in [authentication §2](../workflows/authentication.md). |
| POST | `/auth/apple` | 🔓 | `{ identityToken, authorizationCode, fullName? }` |
| POST | `/auth/refresh` | 🔓 | Rotation with reuse detection |
| POST | `/auth/logout` · `/auth/logout-all` | 🔐 | |
| POST | `/auth/verify-email` · `/auth/verify-email/resend` | 🔐 | |
| POST | `/auth/forgot-password` · `/auth/reset-password` | 🔓 | `forgot` always returns 202 |
| GET / POST / DELETE | `/auth/identities` · `/auth/identities/:provider` | 🔐 | List, link and unlink Google or Apple. Unlinking the last sign-in method is blocked. |

### Users

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET / PATCH | `/users/me` | 🔐 | Profile, default radius, home area, notification preferences |
| POST | `/users/me/phone` | ✉️ | `{ phone }` (E.164). Sends a 6-digit code; 3 sends per hour. |
| POST | `/users/me/phone/verify` | ✉️ | `{ code }`. Sets `phoneVerifiedAt`. |
| PUT | `/users/me/favourite-sports` | 🔐 | `[{ sportId, skillLevel }]` |
| POST / DELETE | `/users/me/devices` · `/users/me/devices/:pushToken` | 🔐 | Expo push tokens |
| DELETE | `/users/me` | 🔐 | Returns `409` with reasons while the user organises upcoming sessions with confirmed players or has open payment disputes |
| GET | `/users/:id` · `/users/:id/reviews` | 🔐 | Public profile |

### Sports and venues

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/sports` | 🔓 | Cacheable. Includes sport-level min, max and default players. |
| GET | `/venues?q=&sportId=&city=` | 🔐 | Search. Staff-only fields are never returned. |
| GET | `/venues/nearby?lat&lng&radiusKm&sportId` | 🔐 | |
| GET | `/venues/:id` | 🔐 | Includes upcoming joinable sessions |
| POST | `/venues` | 📱 | From Google Places. Deduplicated by `googlePlaceId`; created unverified. |

### Discovery

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/sessions/nearby` | 🔐 | See §3.1 and [location discovery](../architecture/location-discovery.md) |

### Sessions

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST | `/sessions` | 📱 | Both types (§3.2) |
| GET | `/sessions/:id` | 🔓 limited / 🔐 full | The public view powers share links |
| PATCH | `/sessions/:id` | 👑 | Editing rules are in [session lifecycle](../workflows/session-lifecycle.md). Price or capacity changes return the per-participant impact. |
| GET | `/sessions/:id/price-change-preview?totalCostFils=&capacity=` | 👑 | New shares per participant and who would need to consent |
| POST | `/sessions/:id/cancel` | 👑 | `{ note? }`. Payment records are not changed; the organiser handles refunds offline. |
| POST | `/sessions/:id/min-players-decision` | 👑 | `{ decision: "PROCEED" \| "CANCEL" }`. Only when the minimum isn't met, and before the deadline. |
| PUT | `/sessions/:id/organiser-participation` | 👑 | `{ playing: boolean }`. Before start only; respects capacity. |
| GET | `/sessions/:id/events` | 👑 | Timeline |
| GET | `/me/sessions?role=organised\|joined\|interested&bucket=upcoming\|completed\|cancelled` | 🔐 | My Activities |

### Venue coordination (`LOOKING_FOR_PLAYERS`)

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/sessions/:id/venue-arrangement` | 👑 | Status and options. Staff notes are excluded. |
| POST | `/sessions/:id/venue-options/:optionId/approve` | 👑 | Other open options become `WITHDRAWN`; arrangement becomes `APPROVED` |
| POST | `/sessions/:id/venue-options/:optionId/reject` | 👑 | `{ reason? }` |
| POST | `/sessions/:id/venue-options` | 👑 | Organiser-proposed option (pending O-06; disabled by default) |
| POST | `/sessions/:id/venue-booking` | 👑 | Records the booking for the approved option (§3.3). Confirms the venue and makes the session joinable. |
| PATCH | `/sessions/:id/venue-booking` | 👑 | Both types: `{ bookingReference?, venuePaymentStatus? }`. Changes to cost or time go through `PATCH /sessions/:id`. |

### Participants

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| POST / DELETE | `/sessions/:id/interest` | ✉️ | LFP with venue `PENDING` only; holds no spot (pending O-01) |
| POST | `/sessions/:id/join` | ✉️ | §3.4. Returns `{ participant, payment? }`. |
| POST | `/sessions/:id/leave` | 🎟 | Allowed until start (pending O-08). No platform penalty. |
| GET | `/sessions/:id/participants` | 🔐 | Confirmed players (names, avatars). The organiser also sees each player's payment status. |
| DELETE | `/sessions/:id/participants/:userId` | 👑 | `{ reason? }` → `REMOVED_BY_ORGANISER` |
| PUT | `/sessions/:id/participants/:userId/attendance` | 👑 | `{ status: "ATTENDED" \| "NO_SHOW" }`. Until 72 h after end (pending O-07). |
| GET | `/sessions/:id/price-consents/me` | 🎟 | Pending consent, if any |
| POST | `/price-consents/:id/accept` · `/price-consents/:id/reject` | 🎟 | Reject leaves the session with `PRICE_REJECTED` and no penalty |

### Offline payments

Payments are records only. No money moves through PlayAround (DEC-012). Rules are in [offline payments](../workflows/offline-payments.md).

| Method | Path | Access | Notes |
| --- | --- | --- | --- |
| GET | `/me/payments?role=payer\|payee&status=` | 🔐 | The player's dues, or the organiser's receivables |
| GET | `/sessions/:id/payments` | 👑 | Every payment record for the session, with totals |
| GET | `/payments/:id` | payer, payee | Record plus action log (§3.5) |
| POST | `/payments/:id/report` | payer | `{ method, reference?, note? }` → `PAYMENT_REPORTED` |
| POST | `/payments/:id/retract-report` | payer | `PAYMENT_REPORTED → UNPAID` |
| POST | `/payments/:id/confirm` | payee | `{ amountFils?, method?, note? }` → `PAID`. Defaults to the outstanding amount. |
| POST | `/payments/:id/reject-report` | payee | `{ reason, description? }`. Opens a dispute (`PAYMENT_NOT_RECEIVED`). |
| POST | `/payments/:id/waive` | payee | `{ note? }` → `WAIVED` |
| POST | `/payments/:id/refund` | payee | `{ amountFils, method?, note? }`. Must be ≤ paid minus already refunded. |
| POST | `/payments/:id/disputes` | payer, payee | `{ reason, description? }`. One open dispute per payment. |
| POST | `/payment-disputes/:id/withdraw` | dispute opener | Restores `status_before_dispute` |
| POST | `/sessions/:id/payments/remind` | 👑 | Sends `PAYMENT_REMINDER` to unpaid players; once per 12 h per session |

The organiser resolves a dispute raised against them by confirming or waiving. Otherwise staff resolve it through the admin endpoints.

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
| POST | `/sessions/:id/reviews` | 🔐 | Confirmed co-participants of `COMPLETED` sessions, within 7 days |
| POST | `/reports` | 🔐 | `{ targetType, targetId, reason, details }` |
| POST | `/uploads/sign` | 🔐 | `{ purpose: avatar \| session_image \| venue_image }` returns signed Cloudinary upload params (folder, eligible transformations, max size) |
| GET | `/health` · `/health/ready` | 🔓 | |

### Admin (`/admin/*`: staff only, TOTP, audited)

Every staff mutation requires `{ reason }` and writes `admin_audit_logs`. SUPER_ADMIN can do everything below.

| Method | Path | Role |
| --- | --- | --- |
| POST | `/admin/auth/login` | Staff: password, then `MFA_REQUIRED` |
| POST | `/admin/auth/mfa/verify` · `/admin/auth/mfa/enrol` · `/admin/auth/mfa/recover` | Staff |
| POST | `/admin/auth/refresh` · `/admin/auth/logout` | Staff |
| GET | `/admin/metrics/overview` | Any staff |
| GET | `/admin/users` · `/admin/users/:id` | Any staff |
| POST | `/admin/users/:id/suspend` · `/reactivate` | OPERATIONS |
| PATCH | `/admin/users/:id/role` | SUPER_ADMIN |
| GET | `/admin/sessions` · `/admin/sessions/:id` (including timeline, booking, payments) | Any staff |
| POST | `/admin/sessions/:id/cancel` | OPERATIONS |
| DELETE | `/admin/sessions/:id/participants/:userId` | SUPPORT, OPERATIONS |
| GET | `/admin/venue-arrangements?status=&assignee=` · `/admin/venue-arrangements/:id` | OPERATIONS |
| POST | `/admin/venue-arrangements/:id/assign` `{ assigneeId }` | OPERATIONS |
| PATCH | `/admin/venue-arrangements/:id` `{ status?, staffNotes? }` (for example `UNSUCCESSFUL`) | OPERATIONS |
| POST | `/admin/venue-arrangements/:id/options` · PATCH / DELETE `/admin/venue-options/:id` | OPERATIONS |
| POST | `/admin/sessions/:id/venue-booking` (record on the organiser's behalf) | OPERATIONS |
| GET / POST / PATCH | `/admin/sports` · `/admin/sports/:id` | OPERATIONS |
| GET / POST / PATCH | `/admin/venues` · `/admin/venues/:id` (including staff contact fields) | OPERATIONS |
| POST | `/admin/venues/:id/merge` `{ intoVenueId }` | OPERATIONS |
| GET | `/admin/payments` · `/admin/payments/:id` | Any staff |
| POST | `/admin/payments/:id/confirm` · `/waive` · `/refund` · `/correct-status` | SUPPORT |
| GET | `/admin/payment-disputes?status=` · `/admin/payment-disputes/:id` | Any staff |
| POST | `/admin/payment-disputes/:id/resolve` `{ resolutionStatus, note }` | SUPPORT |
| GET / PATCH | `/admin/reports` · `/admin/reports/:id` | SUPPORT, OPERATIONS |
| PATCH | `/admin/reviews/:id` `{ isHidden }` | SUPPORT, OPERATIONS |
| GET / PUT | `/admin/settings` · `/admin/settings/:key` | SUPER_ADMIN |
| GET | `/admin/audit-logs` | SUPER_ADMIN |

## 3. Key payloads

### 3.1 `GET /sessions/nearby`

| Param | Default | Notes |
| --- | --- | --- |
| `lat`, `lng` | required | GPS or a manually selected point |
| `radiusKm` | user default (5) | 0.5–50 |
| `autoExpand` | `true` | 2 → 5 → 10 → 25 → 50 |
| `sportIds` | all | CSV |
| `types` | both | `EXISTING_BOOKING,LOOKING_FOR_PLAYERS` |
| `joinableOnly` | `false` | `true` hides LFP sessions whose venue is `PENDING` |
| `from`, `to` | now → +14 d | |
| `timeOfDay` | — | `morning,afternoon,evening,night` (Asia/Dubai) |
| `minPriceFils`, `maxPriceFils` | — | Per-player share (estimated while the venue is pending) |
| `minSpots` | 1 | |
| `skillLevel` | — | |
| `sort` | `distance` | Also `soonest`, `price`, `recommended` |
| `limit`, `cursor` | 20 | |

`SessionSummary` is used by cards, the detail header and socket patches:

```json
{
  "id": "…",
  "type": "LOOKING_FOR_PLAYERS",
  "status": "OPEN",
  "venueConfirmationStatus": "PENDING",
  "joinable": false,
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
  "minPlayers": 8,
  "confirmedCount": 1,
  "interestedCount": 6,
  "spotsLeft": 9,
  "price": {
    "isEstimate": true,
    "isFree": false,
    "perPlayerMax": { "amountFils": 4000, "currency": "AED" },
    "total": { "amountFils": 40000, "currency": "AED" }
  },
  "paymentNote": "Pay the organiser directly. PlayAround doesn't collect payments.",
  "skillLevel": null,
  "organiser": { "id": "…", "displayName": "Ravi S.", "avatarUrl": "…", "ratingAvg": 4.7, "isPlaying": true },
  "participantPreview": [{ "id": "…", "avatarUrl": "…" }],
  "distanceKm": 1.9,
  "band": "LE_2",
  "viewer": { "participantStatus": null, "isInterested": true, "paymentStatus": null, "amountDue": null, "pendingPriceConsentId": null },
  "version": 7
}
```

### 3.2 `POST /sessions`

```json
// EXISTING_BOOKING
{
  "type": "EXISTING_BOOKING",
  "sportId": 1,
  "venue": { "venueId": "…" },                  // or { "newVenue": { …POST /venues body } }
  "startsAt": "…", "endsAt": "…",
  "capacity": 4,
  "minPlayers": 4,                              // optional; ≥ sport minimum, ≤ capacity
  "organiserIsPlaying": true,
  "totalCostFils": 12000,                       // 0 = free (pending O-09)
  "bookingReference": "DSC-88213",              // optional (DEC-030)
  "venuePaymentStatus": "PAID",                 // informational
  "skillLevel": "INTERMEDIATE",
  "title": "Evening doubles", "instructions": "Court 3", "imageKeys": []
}

// LOOKING_FOR_PLAYERS
{
  "type": "LOOKING_FOR_PLAYERS",
  "sportId": 2,
  "preferredArea": { "label": "JLT, Dubai", "latitude": 25.0693, "longitude": 55.1413, "radiusKm": 3, "googlePlaceId": "…" },
  "startsAt": "…", "endsAt": "…",               // preferred time
  "capacity": 10,
  "minPlayers": 8,
  "organiserIsPlaying": true,
  "estimatedTotalCostFils": 40000,
  "instructions": "Looking for a 5-a-side pitch around JLT"
}
```

The server computes these fields, and the strict schema rejects them if the client sends them: `status`, `venueConfirmationStatus`, counters, the share fields, `venueConfirmDeadline` (O-02), `minPlayersDecisionDeadline` (DEC-032, O-14), coordinates, timezone and `locationPrecision`.

Validation (`contracts/rules`):
- Capacity is within the sport's limits, and `minPlayers` is between the sport minimum and capacity.
- Start is ≥ 3 h ahead (DEC-024) and ≤ 60 days ahead.
- Duration is 30 min–6 h.
- Cost is 0–1,000,000 fils.
- The smallest share is ≥ `payments.min_paid_share_fils` unless the session is free (DEC-020, O-15).
- The organiser has fewer than 10 upcoming organised sessions (DEC-025).
- The organiser's phone is verified (DEC-036).

### 3.3 `POST /sessions/:id/venue-booking` (LFP)

```json
{
  "venueOptionId": "…",
  "totalCostFils": 36000,           // defaults to the option price
  "startsAt": "…", "endsAt": "…",   // default to the option time
  "bookingReference": "…",          // optional
  "venuePaymentStatus": "PAID"
}
```

Returns the updated `SessionSummary`, with venue `CONFIRMED` and `joinable: true`. Users who expressed interest receive `SESSION_JOINABLE`.

### 3.4 `POST /sessions/:id/join`

```json
// 201: paid session
{
  "participant": { "id": "…", "status": "CONFIRMED", "shareSlot": 2 },
  "payment": { "id": "…", "status": "UNPAID", "amountDue": { "amountFils": 3333, "currency": "AED" },
               "payTo": { "organiserId": "…", "displayName": "Ravi S." } }
}
// 201: free session
{ "participant": { "id": "…", "status": "CONFIRMED", "shareSlot": 2 }, "payment": null }
```

Errors:
- `SESSION_NOT_JOINABLE` while an LFP venue is pending.
- `SESSION_FULL`.
- `SESSION_STARTED`.
- `REMOVED_BY_ORGANISER` if the organiser removed this user earlier.

### 3.5 `GET /payments/:id`

```json
{
  "id": "…", "status": "PAYMENT_REPORTED",
  "amountDue": { "amountFils": 3333, "currency": "AED" },
  "agreedAmount": { "amountFils": 3333, "currency": "AED" },
  "amountPaid": { "amountFils": 0, "currency": "AED" },
  "refundedAmount": { "amountFils": 0, "currency": "AED" },
  "participantStatus": "CONFIRMED",
  "session": { "id": "…", "title": "…", "startsAt": "…" },
  "payer": { "id": "…", "displayName": "…" },
  "payee": { "id": "…", "displayName": "…" },
  "openDispute": null,
  "log": [
    { "action": "REPORTED_BY_PLAYER", "actorRole": "PLAYER", "toStatus": "PAYMENT_REPORTED", "method": "CASH", "createdAt": "…" }
  ],
  "version": 3
}
```

## 4. Socket.IO contract

The client connects with handshake `auth: { token }`, which is optional for public session rooms. The server persists every change before it emits the event.

| Direction | Event | Payload |
| --- | --- | --- |
| Client → server | `session:subscribe` / `session:unsubscribe` | `{ ids: string[] }` (≤ 50) |
| Server → client | `session:availability` | `{ id, status, confirmedCount, interestedCount, spotsLeft, joinable, version }` |
| Server → client | `session:status` | `{ id, status, venueConfirmationStatus, cancellationReason?, version }` |
| Server → client | `session:updated` | `{ id, changedFields[], version }`; the client refetches the detail |
| Server → client | `session:venue_confirmed` | `{ id, location, price, startsAt, endsAt, version }` |
| Server → client | `session:participant_joined` / `_left` | `{ sessionId, user?, userId, version }` |
| Server → client | `participant:updated` (user room) | `{ sessionId, status, cancellationReason? }` |
| Server → client | `payment:updated` (payer and payee rooms) | `{ paymentId, sessionId, status, amountDueFils, version }` |
| Server → client | `price_consent:required` (user room) | `{ consentId, sessionId, previousAmountFils, newAmountFils, deadline }` |
| Server → client | `venue_arrangement:updated` (organiser room) | `{ sessionId, status, optionsCount }` |
| Server → client | `notification:new` / `notification:unread_count` | `Notification` / `{ count }` |
| Server → client | `admin:feed` (admin room) | `{ kind: "venue_arrangement" \| "payment_dispute" \| "report" \| …, refId, summary }` |

## 5. Rate limits

| Scope | Limit |
| --- | --- |
| Login, register, social sign-in | 10 per 15 min per IP and per email |
| Forgot password, resend verification | 3 per hour per account |
| Phone codes | 3 sends per hour per user and per number; 5 attempts per code |
| Admin login + TOTP | 5 attempts per 15 min per account |
| `/sessions/nearby` | 60 per min per user |
| `POST /sessions` | 20 per day per user |
| Join, leave, interest | 30 per min per user |
| Payment actions | 30 per min per user |
| Admin | 120 per min per staff user |
| Default | 300 per min per user |
