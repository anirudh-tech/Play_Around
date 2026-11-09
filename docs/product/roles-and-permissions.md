# User Roles and Permissions

## 1. Role model

| Role | Kind | Stored as | Notes |
| --- | --- | --- | --- |
| Guest | Unauthenticated | — | Landing page, public session share page (limited data) |
| User | Member | `users.role = USER` | Can join any session. Can organise once a phone is verified (DEC-036). |
| Organiser | **Contextual**: the user who created a given session | `sessions.organiser_id` | Not a separate account type |
| Participant | **Contextual**: a user with a `session_participants` row | `session_participants` | — |
| Support | Staff | `users.role = SUPPORT` | Pending O-12 |
| Operations | Staff | `users.role = OPERATIONS` | Pending O-12 |
| Super admin | Staff | `users.role = SUPER_ADMIN` | Pending O-12 |

All staff must use TOTP two-factor authentication (DEC-037). A future `FINANCE` role belongs to [future online payments](../future/online-payments-stripe.md).

## 2. Member permissions

| Action | Any user | Organiser of the session | Participant | Notes |
| --- | :-: | :-: | :-: | --- |
| Discover sessions, view details | ✅ | ✅ | ✅ | |
| Express interest (unconfirmed LFP) | ✅ | — | — | Pending O-01 |
| Join / leave | ✅ | — | ✅ (leave) | Organiser joins via "I'm playing" |
| Create a session | Verified phone only | — | — | Max 10 upcoming (DEC-025) |
| Edit, cancel session | — | ✅ | — | Price rules (DEC-031) |
| Decide proceed/cancel when the minimum isn't met | — | ✅ | — | DEC-032 |
| Approve/reject venue options; record venue booking | — | ✅ | — | DEC-029 |
| Remove a participant | — | ✅ | — | |
| Mark attendance (`ATTENDED`/`NO_SHOW`) | — | ✅ | — | Pending O-07 |
| See all participants' payment statuses | — | ✅ | Own only | |
| Report "I've paid" | — | — | ✅ | DEC-013 |
| Confirm receipt, waive, record refund | — | ✅ | — | DEC-013, DEC-022 |
| Open a payment dispute | — | ✅ | ✅ | |
| Accept/reject a price increase | — | — | ✅ | DEC-031 |
| Review co-participants | — | ✅ if playing | ✅ | Completed sessions only |
| Report user/session/review | ✅ | ✅ | ✅ | |

## 3. Staff permissions (pending O-12)

| Capability | SUPPORT | OPERATIONS | SUPER_ADMIN |
| --- | :-: | :-: | :-: |
| View users, sessions, payment records, disputes | ✅ | ✅ | ✅ |
| Resolve payment disputes; confirm/correct a payment status ("authorised admin", DEC-013) | ✅ | | ✅ |
| Remove participant; resolve reports; hide reviews | ✅ | ✅ | ✅ |
| Suspend / reactivate users | | ✅ | ✅ |
| Cancel sessions | | ✅ | ✅ |
| Venue arrangement queue: assign, propose options, record bookings | | ✅ | ✅ |
| Venues and sports catalogue (create, edit, verify, merge) | | ✅ | ✅ |
| Platform settings | | | ✅ |
| Manage staff roles; view audit log | | | ✅ |

Every staff mutation requires a reason and writes `admin_audit_logs`.

## 4. Enforcement
- API middleware: `requireAuth`, `requireVerifiedEmail`, `requireVerifiedPhone` (organiser actions), `requireRole(...)` (staff), and ownership checks in services (`session.organiser_id === user.id`).
- Admin tokens carry `scope: admin`, are issued only after TOTP verification, and use a shorter lifetime ([authentication workflow](../workflows/authentication.md)).
- Clients hide actions the user can't perform, but the API is the only enforcement point.
