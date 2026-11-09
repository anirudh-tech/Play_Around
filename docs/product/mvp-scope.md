# MVP Scope

## In scope

### Mobile (iOS + Android) and web: launch together (DEC-003)

| Area | Features |
| --- | --- |
| Onboarding and accounts | Splash, onboarding, sign up / sign in (email, Google, Apple), email verification, password reset, phone verification (required to organise), profile, favourite sports with skill level, settings, account deletion |
| Discover | GPS or manual location, configurable radius with auto-expansion, map and list views, filters (sport, date, time of day, price, spots left, skill level, session type), distance sorting |
| Session details | Sport, venue or preferred area, distance, date/time, total cost and your share, capacity, minimum players, joined players, organiser, instructions, images |
| Join / leave | Instant join when capacity is available; leave; price-change consent |
| Interest | Express interest in an unconfirmed LFP session (pending O-01) |
| Create session | Both types; sport, venue or area, time, capacity, optional minimum, total or estimated cost with a live split preview, instructions, images (Cloudinary) |
| Organiser tools | Participant list with payment status, confirm payments, waive, record refunds, remove participants, minimum-player decision, approve venue options, record venue booking, mark attendance, edit, cancel |
| Offline payments (player) | See amount owed, report payment, view payment history, open a dispute |
| My activities | Organised / joined / interested; upcoming / completed / cancelled |
| Notifications | In-app + push + real-time (see the notification catalogue in [session lifecycle](../workflows/session-lifecycle.md#8-notifications)) |
| Reviews and reports | Review co-participants of completed sessions; report users, sessions, reviews |
| Web extras | SSR landing page and public share page for sessions; desktop split view (filters, list, map) |

### Admin application (DEC-003)
Staff sign-in with mandatory TOTP; users; sessions; venue arrangement queue; venues and sports catalogue; payment records and disputes; reports and moderation; platform settings; audit log. See the [admin application](../architecture/admin-application.md).

### Platform
REST API, Socket.IO real-time updates, Expo push, scheduled jobs (minimum-player deadline, venue deadline, completion/expiry, reminders, price-consent expiry), MySQL 8.4, Cloudinary, Docker Compose for local development.

## Out of scope for the MVP

| Item | Status | Where it lives |
| --- | --- | --- |
| Online payments, Stripe, Stripe Connect, checkout, payouts, provider notifications | Future (DEC-017) | [future/online-payments-stripe.md](../future/online-payments-stripe.md) |
| Platform wallet | Excluded (DEC-021) | — |
| Platform fees / revenue | Deferred (DEC-018) | — |
| Group / session chat | Deferred (DEC-010) | Real-time design leaves room for it |
| Arabic / RTL | Not in MVP (DEC-001) | — |
| Waitlists, recurring sessions, gender/age-restricted sessions | Backlog | [roadmap](../roadmap.md#post-mvp) |
| Venue partner portal / direct venue settlement | Backlog | — |
| Reliability scores / no-show penalties | Backlog (O-07) | — |

## Definition of MVP done
1. All in-scope features work on iOS, Android and web against production.
2. Admin covers venue coordination, payment disputes and moderation.
3. No code path collects, holds or transfers money.
4. Launch approvals L-05, L-07, L-08 and L-09 in the [decision log](../decisions/decision-log.md#4-unresolved-launch-approvals-do-not-block-phase-2) are resolved.
