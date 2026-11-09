> ⚠️ **SUPERSEDED — historical reference only.** Archived 8 Nov 2026.
> This version assumed online payments collected by PlayAround (decision D2 below), which was replaced by the offline-payment MVP.
> Current documents: [product overview](../product/overview.md), [MVP scope](../product/mvp-scope.md), [decision log](../decisions/decision-log.md).

# 01 – Final Product Requirements

Status: **Draft v2** — incorporates the confirmed decisions of 8 Nov 2026. Items still needing a decision are tracked in [02-business-decisions.md](02-business-decisions.md).

## 1. Product summary

PlayAround helps people find others to play sport with nearby, and lets organisers collect each player's share of the cost online.

| Loop | Actor | Outcome |
| --- | --- | --- |
| Discover → Join → Pay | Player | Finds a session nearby, reserves a spot, pays online, is confirmed |
| Create → Fill → Get paid | Organiser | Publishes a game (venue already booked, or still to be arranged), players join and pay, organiser receives the collected shares |

## 2. Confirmed decisions

| # | Decision |
| --- | --- |
| D1 | Sessions can be created **with or without** an existing venue booking. |
| D2 | **Online payments are required.** A participant is only confirmed after the backend verifies a successful payment. |
| D3 | Discovery works from **GPS or a manually selected location**. |
| D4 | **Group chat is postponed.** The real-time and notification design must not block adding it later. |
| D5 | **iOS, Android and web launch together.** |
| D6 | Initial sports: **Badminton, Football, Cricket**, with new sports added through the admin dashboard without code changes. |
| D7 | Applications: React Native mobile app, Next.js web app, **Next.js admin dashboard**, one Node.js backend, one MySQL database. All clients use the same backend API. |

## 3. Session types

| | `EXISTING_BOOKING` | `LOOKING_FOR_PLAYERS` |
| --- | --- | --- |
| Venue | Known, booked by the organiser | Preferred **area** only, until the organiser confirms a venue |
| Date/time | Final | Proposed; can change when the venue is confirmed |
| Cost | Final total booking cost | **Estimated** total; final price set at venue confirmation |
| Venue confirmation status | `CONFIRMED` at creation | `PENDING` → `CONFIRMED` (or `LAPSED`) |
| Players can | Join and pay immediately | **Express interest** (no commitment) or **Join** (holds a spot, pays after venue confirmation) |
| Payments collected | Immediately on join | Only after the organiser confirms venue and final price |
| Shown on map as | Exact venue pin | Area circle, until confirmed |

Session status (availability and lifecycle) and venue confirmation status are **separate fields**. Full rules are in the [session lifecycle](../architecture/02-session-lifecycle.md).

## 4. Functional requirements

### 4.1 Accounts and profiles
- Register/login (method to be decided: see the business decisions doc), email verification, password reset, refresh-token sessions on multiple devices.
- Profile: display name, avatar, bio, favourite sports with skill level, default discovery radius, optional coarse home area (private).
- Account deletion (App Store / Play requirement). Blocked while the user has unsettled payments or payouts; otherwise soft delete + PII scrub.

### 4.2 Discovery
- GPS location or manual area selection; configurable radius; auto-expanding radius when results are sparse.
- Filters: sport, date range, time of day, price per player, spots left, skill level, session type, venue confirmed only.
- Sorting: nearest (default), soonest, cheapest, recommended.
- Map view and list view on mobile; split list + map on desktop web.
- Only sessions that can still accept participants (`OPEN`, start in the future) are listed. FULL sessions with reserved-but-unpaid spots show "spots may free up".

### 4.3 Creating sessions
- Choose type → sport → venue (search/Places/map pin) **or** preferred area → date/time → capacity → total or estimated cost → skill level → instructions → optional images → review → publish.
- Server computes cost per player and the player-facing price breakdown.
- Organisers must have an **active payout account** (KYC done with the payment provider) before publishing a paid session. Free sessions (cost 0) need no payout account.
- Organiser is a confirmed participant automatically when they play (their share is covered by having paid the venue).
- `LOOKING_FOR_PLAYERS` requires a **venue confirmation deadline** (default: 12 h before proposed start).

### 4.4 Joining, paying and leaving
- `EXISTING_BOOKING`: Join → spot reserved for a limited time (default 15 min) → checkout → backend verifies payment via signed webhook → participant `CONFIRMED`.
- `LOOKING_FOR_PLAYERS`: Express interest (no spot) or Join (spot held, no payment). After the venue is confirmed, holders get a **payment due** window (default 12 h, never later than 2 h before start). Unpaid holds are released.
- Expired reservations are released automatically and the session reopens.
- Leaving: refunds follow the [refund policy](../architecture/04-payments.md#4-refund-policy-proposed).
- Organiser can remove a participant (automatic full refund).
- Organiser cancellation, or a missed venue-confirmation deadline, cancels the session and refunds everyone in full automatically.

### 4.5 Payments
- Individual per-player payments; hosted checkout; Apple Pay / Google Pay where the provider supports them.
- Payment history (payments, refunds) for players; earnings and payouts for organisers.
- Failed payment retry within the reservation window.
- Duplicate payment prevention, request idempotency, full transaction ledger, signed webhook verification, reconciliation job.
- Provider-agnostic payment module (adapter pattern).

### 4.6 Notifications
In-app (persisted) + push + real-time for: player joined/left/removed, interest received, session full/reopened, venue confirmed, payment due, reservation expiring/expired, payment succeeded/failed, refund issued, session updated/cancelled, reminders (24 h, 1 h), payout sent.

### 4.7 Reviews and safety
- Reviews between confirmed co-participants of `COMPLETED` sessions within 7 days.
- Report a user / session / review; block list deferred to v1.1.

### 4.8 Admin dashboard
Operations, finance and support tooling. See [admin dashboard architecture](../architecture/05-admin-dashboard.md).

## 5. Out of scope for MVP
- Group/session chat (designed for, not built).
- Venue partner accounts and direct venue settlement (designed for; see payments doc).
- Waitlists, recurring sessions, wallets/credits, Arabic/RTL, gender/age-restricted sessions.

## 6. Non-functional requirements

| Concern | Target |
| --- | --- |
| Discovery latency | p95 < 300 ms for 10 km at 100k upcoming sessions |
| Capacity correctness | Zero overbooking under concurrent joins and late payment webhooks |
| Payment correctness | Every provider event processed exactly once; ledger reconciles daily with the provider |
| Security | OWASP API Top 10; PCI scope SAQ-A (card data never touches our servers); secrets in env/secret manager |
| Availability | 99.5% MVP; webhook endpoint must respond < 2 s |
| Accessibility | WCAG AA contrast on glass surfaces; font scaling respected |
| Observability | Structured logs, request IDs, Sentry, payment/webhook dashboards in admin |
