# Decision Log

The single register of PlayAround decisions. Other documents reference these IDs and do not restate a decision differently.

**Status values**

| Status | Meaning |
| --- | --- |
| **Approved** | Confirmed by the product owner. Implement as written. |
| **Provisional** | Approved as a configurable default, explicitly subject to later review. |
| **Recommended** | Proposed by architecture. Used as the working assumption, but needs product-owner confirmation (see §3). |
| **Unresolved** | Open business or launch item. Must not be assumed. |
| **Superseded** | Replaced by a later decision; kept for history. |

---

## 1. Approved and provisional decisions

| ID | Topic | Final decision | Reason | Status | Date |
| --- | --- | --- | --- | --- | --- |
| DEC-001 | Market | UAE first. English only. Currency AED. Timezone Asia/Dubai. | Focused launch market | Approved | 2026-11-08 |
| DEC-002 | Sports | Badminton, football, cricket at launch. Sports are data (catalogue table), so new sports need no architectural change. | Original brief: support more sports later without major changes | Approved | 2026-11-08 |
| DEC-003 | Applications | Mobile (iOS + Android) and web launch together; separate admin application. All use the same API. | Simultaneous launch on all platforms | Approved | 2026-11-08 |
| DEC-004 | Tech stack | Monorepo with pnpm + Turborepo. Mobile: React Native + Expo + TypeScript. Web: Next.js + TypeScript. Admin: Next.js + TypeScript. API: Node.js + Express + TypeScript. Database: PostgreSQL + Prisma (DEC-042). | Team skills; one language across the stack | Approved | 2026-11-08 |
| DEC-005 | Shared code | One `contracts` package (Zod schemas + inferred types + shared rules) replaces separate `shared-types` and `validation` packages. | Types inferred from schemas cannot drift | Approved | 2026-11-08 |
| DEC-006 | Image storage | Cloudinary | Signed direct uploads and built-in transforms | Approved | 2026-11-08 |
| DEC-007 | Local development | Docker Compose (PostgreSQL 16 + dev mail server) | Reproducible local setup | Approved | 2026-11-08 |
| DEC-008 | Node.js runtime | Pin **Node.js 26.13.0** Active LTS (`Lithium`) via `.nvmrc` and `engines: ">=26.13.0 <27"`. Evaluated in Phase 2 against Expo SDK 58, Next.js 16.4, Prisma 7.10, TypeScript 6.0, pnpm 12. | Current LTS; all primary tools ran on 26.13.0. Prisma 7 still warns that it officially supports Node 20.19+/22.12+/24+; generate, validate, migrate-diff and runtime succeeded anyway. Prisma 8 (RC at evaluation time) is the first Prisma line that lists Node 26. Revisit if Prisma 7 breaks on a later 26.x. | Approved | 2026-11-08 |
| DEC-009 | Location | GPS and manual location selection | Users who deny location must still be able to search | Approved | 2026-11-08 |
| DEC-010 | Chat | Group chat deferred. Real-time and notification design must not block adding it later. | MVP focus | Approved | 2026-11-08 |
| DEC-011 | Session types | `EXISTING_BOOKING` (organiser already has a venue booking) and `LOOKING_FOR_PLAYERS` (venue arranged after creation) | Two core organiser situations | Approved | 2026-11-08 |
| DEC-012 | Payments model | Offline payments only in the MVP. Players pay organisers directly. PlayAround does not collect, hold or transfer player money. | Avoids payment licensing, provider onboarding and settlement complexity for launch | Approved | 2026-11-08 |
| DEC-013 | Payment confirmation | Players may report that they have paid. Only the organiser or an authorised admin can confirm receipt of an offline payment. | The receiver of the money is the only reliable confirmer | Approved | 2026-11-08 |
| DEC-014 | Venue payment | In the normal MVP flow the organiser pays the venue directly. PlayAround records payment and venue booking information. | PlayAround holds no funds | Approved | 2026-11-08 |
| DEC-015 | State model | Participation and payment are independent. Participant statuses: `CONFIRMED`, `CANCELLED`, `ATTENDED`, `NO_SHOW`. Payment statuses: `UNPAID`, `PAYMENT_REPORTED`, `PAID`, `PAYMENT_DISPUTED`, `WAIVED`, `REFUNDED`. | Paying and playing are separate facts in an offline model | Approved | 2026-11-08 |
| DEC-016 | Joining | Joining confirms participation if capacity is available. It does not mean the player has paid. | No online checkout gate | Approved | 2026-11-08 |
| DEC-017 | Future payments | Stripe is the preferred future provider, with Tap as a possible fallback, subject to provider and legal approval. Stripe, Connect, online checkout and payouts are excluded from MVP implementation. | Keep a path to online payments without building it now | Approved | 2026-11-08 |
| DEC-018 | Revenue | Platform revenue deferred. No service fees in the MVP. | Focus on liquidity first | Approved | 2026-11-08 |
| DEC-019 | Money handling | Store money as integer fils wherever practical; currency AED. Per-player splits use largest-remainder allocation (AED 100 ÷ 3 = 33.34 + 33.33 + 33.33). | Exact arithmetic; splits always sum to the total | Approved | 2026-11-08 |
| DEC-020 | Minimum paid price | AED 10 per player for paid sessions. Configurable. | Avoids trivial amounts | Provisional (subject to later review) | 2026-11-08 |
| DEC-021 | Money features excluded | No platform wallet. No organiser payouts. No Stripe settlement tables or endpoints in the MVP. | Follows from DEC-012 | Approved | 2026-11-08 |
| DEC-022 | Refunds | Offline refunds are handled directly between organiser and player and recorded in the system. | Follows from DEC-012 | Approved | 2026-11-08 |
| DEC-023 | Payment records | MVP keeps offline payment records in `payments`, `payment_confirmations` and `payment_disputes`. | Traceability and dispute support without handling money | Approved | 2026-11-08 |
| DEC-024 | Lead time | Minimum 3 hours between creation and start, for both session types. | Gives players time to discover and join | Approved | 2026-11-08 |
| DEC-025 | Organiser limit | Maximum 10 upcoming organised sessions per user. | Abuse and spam control | Approved | 2026-11-08 |
| DEC-026 | Capacity and minimum | Maximum capacity is separate from minimum players. Minimum players are optional. An organiser-set minimum cannot be below a configured sport-level minimum. | Flexible games with sport-specific sanity limits | Approved | 2026-11-08 |
| DEC-027 | Organiser participation | Organisers may participate or create sessions without participating. They count towards capacity and minimum players only when participating. | Supports organisers who only arrange games | Approved | 2026-11-08 |
| DEC-028 | LFP joinability | A venue must be confirmed before a `LOOKING_FOR_PLAYERS` session becomes joinable. | Players commit only to a real time, place and price | Approved | 2026-11-08 |
| DEC-029 | Venue arrangement | PlayAround coordinates venue discovery and booking arrangements. The organiser approves the venue and pays it directly. | Platform adds value without holding funds | Approved | 2026-11-08 |
| DEC-030 | Booking reference | An existing booking reference is optional. | Low friction for organisers | Approved | 2026-11-08 |
| DEC-031 | Price increases | Increases greater than 20% require notification and explicit participant consent. Participants who reject the revised price can leave without a platform cancellation penalty. | Protects players from surprise costs | Approved | 2026-11-08 |
| DEC-032 | Minimum not met | If a configured minimum is not met by the decision deadline (default 2 hours before start), the organiser may proceed or cancel. With no decision by the deadline, the session is cancelled automatically and participants are notified. | Clear outcome for under-subscribed games | Approved | 2026-11-08 |
| DEC-033 | Completion | A session completes only when its venue is confirmed and at least two confirmed participating players exist at session end. A non-participating organiser does not count. | A game needs a place and at least two players | Approved | 2026-11-08 |
| DEC-034 | Removed MVP rules | Removed: checkout holds, 15-minute reservation TTL, 12-hour payment window, three-unpaid-hold cap. | Not applicable to offline payments | Approved | 2026-11-08 |
| DEC-035 | Sign-in methods | Email/password, Google Sign-In and Sign in with Apple at launch. | User expectation; Apple requires its own sign-in alongside Google on iOS | Approved | 2026-11-08 |
| DEC-036 | Phone numbers | Phone optional for players. Verified phone required for organisers before publishing sessions. | Accountability for organisers | Approved | 2026-11-08 |
| DEC-037 | Staff security | TOTP two-factor authentication mandatory for all staff accounts. | Admin can change payment and session records | Approved | 2026-11-08 |
| DEC-038 | Legal documents | Terms, privacy policy and organiser agreement are required before public launch. | Legal baseline | Approved (drafting and approval are launch item L-05) | 2026-11-08 |
| DEC-039 | Documentation | Docs live in `product/`, `architecture/`, `database/`, `api/`, `workflows/`, `future/`, `decisions/`, `archive/`, plus `roadmap.md` and `README.md`. | One canonical document per topic | Approved | 2026-11-08 |
| DEC-040 | Domain | `playaround.app` proposed. Availability and ownership must be verified before use. | — | Recommended (launch item L-07) | 2026-11-08 |
| DEC-041 | Hosting | AWS Middle East region (UAE, `me-central-1`), subject to cost and data-residency review. | Latency and residency for UAE users | Recommended (launch item L-08) | 2026-11-08 |
| DEC-042 | Database engine | PostgreSQL (Prisma + Docker Postgres 16). Replaces MySQL 8.4 in DEC-004 / DEC-007. | Owner request; managed Postgres is easier to host for previews (Neon, Render, Vercel-adjacent) | Approved | 2026-11-10 |

## 2. Architecture baseline (recommended, carried from Phase 1)

These technical choices come from the Phase 1 design and haven't been contradicted. They're the working assumptions for Phase 2. Object to any of them before implementation starts.

| ID | Topic | Recommendation | Reason | Status | Date |
| --- | --- | --- | --- | --- | --- |
| ARC-001 | Backend shape | Modular monolith: one Express deployable; REST API, Socket.IO and jobs as separate modules | One team, one database, transactional rules | Recommended | 2026-11-08 |
| ARC-002 | IDs | UUID v7 (`CHAR(36)`) for entity IDs | Time-ordered, non-guessable | Recommended | 2026-11-08 |
| ARC-003 | Auth tokens | Access JWT (15 min) + rotating refresh token (30 days) with reuse detection; httpOnly cookie on web/admin, secure storage on mobile | Standard, revocable sessions | Recommended | 2026-11-08 |
| ARC-004 | Capacity safety | Row lock on the session for join/leave/capacity edits + database CHECK constraints + unique keys | No overbooking under concurrency | Recommended | 2026-11-08 |
| ARC-005 | Discovery | Indexed bounding box + `ST_Distance_Sphere`; spatial index as a later upgrade | Simple with Prisma; fast at expected scale | Recommended | 2026-11-08 |
| ARC-006 | Real-time | Socket.IO rooms per session and per user; persist first, then emit | Offline users still get notifications | Recommended | 2026-11-08 |
| ARC-007 | Push | Expo Push Notifications | Same API for iOS and Android | Recommended | 2026-11-08 |
| ARC-008 | API style | REST `/api/v1`, OpenAPI generated from `contracts` | Mobile versioning; single source of truth | Recommended | 2026-11-08 |
| ARC-009 | Design | Apple-inspired glass design system with shared design tokens; UI components not shared between React Native and web | Platform-appropriate components, consistent look | Recommended | 2026-11-08 |

## 3. Open product questions (need approval; do not block Phase 2)

These are gaps where the approved decisions don't say enough to implement. Each has a recommendation used as a **placeholder** in the docs, marked "(pending O-xx)".

| ID | Topic | Question | Recommendation | Status | Blocks |
| --- | --- | --- | --- | --- | --- |
| O-01 | Interest before venue confirmation | `LOOKING_FOR_PLAYERS` sessions aren't joinable until the venue is confirmed (DEC-028). Keep the earlier requirement that players can **express interest** before then? | Yes: interest holds no spot and only triggers a notification when the session becomes joinable | Unresolved | Phase 4 |
| O-02 | LFP venue confirmation deadline | The earlier 12-hour default wasn't re-confirmed. What deadline applies, and what about sessions created less than 12 hours before start (allowed by the 3-hour lead time)? | Default 12 h before start; if created later than that, deadline = 2 h before start (same as the minimum-player deadline). Configurable. | Unresolved | Phase 4 |
| O-03 | Price-consent non-response | What happens if a participant neither accepts nor rejects a >20% increase? Deadline? | Consent deadline = earlier of 24 h after notice or 2 h before start. No response = not consented → participation cancelled with reason `PRICE_NOT_ACCEPTED` and no penalty. | Unresolved | Phase 4 |
| O-04 | Price changes near start | Can organisers raise the price close to start? | Block price increases within 2 h of start | Unresolved | Phase 4 |
| O-05 | Split slot order | Which players receive the extra fils from a largest-remainder split? | Slot order: participating organiser first, then players by join time | Unresolved | Phase 4 |
| O-06 | Organiser-sourced venues | For `LOOKING_FOR_PLAYERS`, may organisers propose their own venue option, or only PlayAround staff? | Both may propose; organiser approval always required | Unresolved | Phase 6 |
| O-07 | Attendance marking | Who marks `ATTENDED` / `NO_SHOW`, and until when? Any consequence of `NO_SHOW`? | Organiser or authorised admin, from start until 72 h after end; recorded only, no automatic penalty in the MVP | Unresolved | Phase 4 |
| O-08 | Leave cut-off | Until when can a participant leave? | Until session start | Unresolved | Phase 4 |
| O-09 | Free sessions | Are free sessions (total cost 0) allowed? | Yes; no payment records are created | Unresolved | Phase 4 |
| O-10 | Offline payment methods | Which methods can be recorded? | `CASH`, `BANK_TRANSFER`, `PAYMENT_APP`, `OTHER` + optional reference | Unresolved | Phase 6 |
| O-11 | Refund expectations | Is an organiser expected to refund players when they cancel or when a player leaves? PlayAround records refunds but doesn't define them. | Cover in the organiser agreement (L-05); the app shows "refund may be due" when a paid participation is cancelled | Unresolved | Launch |
| O-12 | Staff roles | Which staff roles exist without finance operations? | `SUPPORT`, `OPERATIONS`, `SUPER_ADMIN` (the `FINANCE` role moves to future payments) | Unresolved | Phase 3 |
| O-13 | SMS provider | Which provider sends phone-verification codes? | Choose in Phase 3 (e.g. Twilio Verify or AWS SNS), subject to UAE sender-ID rules and cost | Unresolved | Phase 3 |
| O-14 | Minimum-player deadline override | May organisers choose a different decision deadline than the 2-hour default? | Yes, earlier only (never later than 2 h before start) | Unresolved | Phase 4 |
| O-15 | Paid-session minimum basis | Is AED 10 checked against the smallest per-player share? | Yes: every share must be ≥ AED 10 unless the session is free | Unresolved | Phase 4 |
| O-16 | Venue coordination service level | What response time should staff target for venue arrangement requests, and in which hours? | Define before launch; the admin queue shows time until the venue deadline either way | Unresolved | Launch |

## 4. Unresolved launch approvals (do not block Phase 2)

| ID | Item | Status |
| --- | --- | --- |
| L-01 | Company registration status and jurisdiction | Unresolved |
| L-02 | Launch city commitments | Unresolved |
| L-03 | Expected weekly session volume | Unresolved |
| L-04 | Launch date | Unresolved |
| L-05 | Terms, privacy policy and organiser agreement drafted and legally approved | Unresolved |
| L-06 | Payment provider and legal approval for future online payments (Stripe / Tap) | Unresolved (future, not MVP) |
| L-07 | Domain `playaround.app` availability and ownership | Unresolved |
| L-08 | Hosting cost and data-residency review | Unresolved |
| L-09 | App Store and Google Play developer accounts | Unresolved |

## 5. Superseded decisions

| ID | Topic | Earlier decision | Replaced by | Status | Date |
| --- | --- | --- | --- | --- | --- |
| SUP-001 | Payments | Online payments required; participant confirmed only after verified online payment | DEC-012, DEC-015, DEC-016 | Superseded | 2026-11-08 |
| SUP-002 | Settlement | PlayAround as merchant of record; delayed organiser payouts after a 48 h hold | DEC-012, DEC-021; kept in [future/online-payments-stripe.md](../future/online-payments-stripe.md) | Superseded | 2026-11-08 |
| SUP-003 | Revenue | Player service fee (flat or %) | DEC-018 | Superseded | 2026-11-08 |
| SUP-004 | Reservations | 15-min checkout reservation, 12-h LFP payment window, 3-hold cap, `HELD`/`PENDING_PAYMENT` states | DEC-034, DEC-015 | Superseded | 2026-11-08 |
| SUP-005 | Organiser verification | Payment-provider KYC before publishing paid sessions | DEC-036 | Superseded | 2026-11-08 |
| SUP-006 | Refund policy | Platform-enforced refund rules (24 h free leave, fee kept, etc.) | DEC-022 | Superseded | 2026-11-08 |
| SUP-007 | Rounding | Round each share up to the next fil (`ceil(total / capacity)`) | DEC-019 | Superseded | 2026-11-08 |
| SUP-008 | Venue role | Venue not a party; organiser arranges venues off-platform | DEC-029 | Superseded | 2026-11-08 |
| SUP-009 | LFP joining | Players could join (hold a spot) before the venue was confirmed | DEC-028 | Superseded | 2026-11-08 |
| SUP-010 | Lead time | 30 min for existing bookings, 3 h for LFP | DEC-024 | Superseded | 2026-11-08 |
| SUP-011 | Shared packages | Separate `shared-types` and `validation` packages | DEC-005 | Superseded | 2026-11-08 |
| SUP-012 | Database engine | MySQL 8.4 + Prisma (DEC-004, DEC-007) | DEC-042 | Superseded | 2026-11-10 |
