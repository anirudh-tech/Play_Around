# Admin Application

## 1. Purpose

The admin application is an internal tool for operating PlayAround in the MVP:
- support and moderation;
- the **venue arrangement queue** for `LOOKING_FOR_PLAYERS` sessions;
- **offline payment disputes** and record corrections;
- catalogue management.

Users are PlayAround staff only (DEC-003). PlayAround handles no money, so the MVP has **no finance, payout or provider-webhook screens**. Those belong to [future online payments](../future/online-payments-stripe.md).

## 2. Application

| Aspect | Choice |
| --- | --- |
| App | `apps/admin`: Next.js App Router, Tailwind, shadcn/ui. Data-dense, with a clean neutral UI and glass used sparingly. |
| Hosting | Separate deployment on an admin subdomain of the launch domain (DEC-040, L-07). Optionally IP allow-listed or behind an access proxy. |
| Data | Same backend: only `/api/v1/admin/*` endpoints plus shared read endpoints. **No direct database access.** |
| Shared code | `packages/contracts` (admin schemas under `contracts/admin`), `packages/api-client` (admin hooks), `packages/design-tokens` |
| Tables | TanStack Table with server-side pagination, sorting and filtering |
| Charts | Recharts (KPIs only) |

## 3. Access control

- Roles on `users.role`: `USER`, `SUPPORT`, `OPERATIONS`, `SUPER_ADMIN` (role split pending O-12).
- Admin sign-in uses a password and then **mandatory TOTP** (DEC-037). The enrolment, recovery and lockout flow is in [authentication](../workflows/authentication.md).
- Admin access tokens carry `scope: admin` and have a 10-minute TTL. The refresh cookie is scoped to the admin domain.
- Every admin mutation requires a reason and writes `admin_audit_logs` (actor, action, target, before/after JSON, IP, reason).

The capability matrix is in [roles and permissions](../product/roles-and-permissions.md#3-staff-permissions-pending-o-12). In summary:

| Capability | SUPPORT | OPERATIONS | SUPER_ADMIN |
| --- | :-: | :-: | :-: |
| View users, sessions, payment records, disputes | ✅ | ✅ | ✅ |
| Resolve payment disputes; confirm, waive, refund or correct a payment record | ✅ | | ✅ |
| Remove participants; resolve reports; hide reviews | ✅ | ✅ | ✅ |
| Suspend or reactivate users; cancel sessions | | ✅ | ✅ |
| Venue arrangement queue; venue and sports catalogue | | ✅ | ✅ |
| Platform settings; staff roles; audit log | | | ✅ |

## 4. Screens

| Area | Content |
| --- | --- |
| Overview | Today's sessions, fill rate, venue requests near their deadline, open payment disputes, sessions awaiting a minimum-player decision, open reports |
| **Venue arrangements** | Queue sorted by time to venue deadline (O-02); filters by status and assignee; detail with session brief, staff-only notes, option editor (venue, time, price, valid until), organiser decisions, "record booking on behalf of organiser", "mark unsuccessful". Target response time is pending O-16. |
| Users | Search; profile; phone and email verification state; linked sign-in methods; sessions hosted and joined; payment records as payer and payee; suspend; audit trail |
| Sessions | Filter by status, type, sport, city and date. Detail shows participants with share slots, venue booking, price changes and consents, minimum-player decision, payment records and timeline. Actions: cancel, remove participant. |
| **Payment records** | Search by user or session. Detail shows amounts (due, agreed, paid, refunded) and the action log. Actions: confirm, waive, record refund, correct status (reason required). |
| **Payment disputes** | Open disputes queue (oldest first). Detail shows both parties' statements and the payment action log. Resolve to a payment status with a note. |
| Venues | List and map; verify; edit, including staff-only contact fields; **merge duplicates** (repoints sessions) |
| Sports | Create, edit or deactivate sports (min/max/default players, icon, accent) without a deploy |
| Reports | Moderation queue (users, sessions, reviews) |
| Settings | `platform_settings`: lead time, organiser limit, minimum-player decision offset, venue deadline, price-consent threshold and window, attendance window, minimum paid share, discovery radius |
| Audit log | Filterable, read-only |

## 5. Backend support

- The module `apps/api/src/modules/admin/` has sub-routers per area and uses `requireRole(...)` middleware.
- Admin endpoints reuse domain services, so admin actions trigger the same state changes and notifications as the equivalent organiser actions. For example:
  - admin cancel calls `sessionsService.cancel(…, { actor: admin })`;
  - admin payment confirm calls `offlinePaymentsService.confirm(…, { actorRole: ADMIN })`.
- `platform_settings` is read through a cached settings service (in memory, 60 s TTL, invalidated on update).
- The Socket.IO `admin` room carries a live feed of new venue arrangement requests, new payment disputes and reports (Phase 9).
