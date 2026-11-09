> ⚠️ **SUPERSEDED — historical reference only.** Archived 8 Nov 2026.
> These were proposals made before the offline-payment decision. Items A1–A10 and A13 (online settlement, service fee, refunds, payouts, KYC, checkout) are not part of the MVP. The current status of every item is in the [decision log](../decisions/decision-log.md).

# 02 – Business Decisions Requiring Approval

Each item has a recommendation. The **blocks** column shows the earliest roadmap phase that needs the answer.

## A. Payments and settlement (blocks Phase 7, but start now; provider onboarding takes weeks)

| # | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| A1 | **Settlement model** | Platform collects player payments as merchant of record and pays organisers **after** the session completes (separate charges + delayed transfers). Venue settlement later. | Phase 7 |
| A2 | **Payment provider** | Open talks with **Stripe (primary)** and **Tap (fallback)** now, using the questions in [payments §3](../architecture/04-payments.md#3-provider-evaluation-uae). Decide when written answers arrive. | Phase 7 |
| A3 | **Legal entity and licensing** | Confirm PlayAround's UAE trade licence (mainland/free zone) covers an online marketplace; get legal advice on the CBUAE retail payment rules for collecting and disbursing on behalf of individuals. | Phase 7 / launch |
| A4 | **Revenue model** | Player service fee on top of the share (e.g. AED 2 flat or 5%, min AED 1). Organiser receives 100% of shares. | Phase 7 |
| A5 | **Who absorbs provider fees** | Covered by the service fee (platform absorbs). | Phase 7 |
| A6 | **VAT** | Register for VAT if the threshold is met; 5% VAT on the service fee, shown in the breakdown. Needs an accountant. | Phase 7 |
| A7 | **Refund policy** | As proposed in [payments §4](../architecture/04-payments.md#4-refund-policy-proposed): free leave ≥ 24 h (fee kept), no refund < 24 h unless the spot is re-filled, full refund on organiser cancel/change/removal. | Phase 7 |
| A8 | **Payout hold** | 48 h after the session ends; blocked by open reports. | Phase 7 |
| A9 | **Organiser KYC requirement** | Mandatory before publishing a **paid** session; free sessions allowed without KYC. | Phase 4 (create-session rules) |
| A10 | **Unfilled spots risk** | Borne by the organiser (they receive only what was paid). | Phase 7 |
| A11 | **Per-player rounding** | Round up to the fil: AED 100 / 3 = AED 33.34. | Phase 4 |
| A12 | **Minimum price** | Paid sessions ≥ AED 10 per player (processing costs make smaller payments uneconomic); otherwise mark the session free. | Phase 4 |
| A13 | **Native payment sheet vs hosted checkout** | Hosted checkout for launch; native sheet later. | Phase 7 |

## B. Sessions

| # | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| B1 | Reservation TTL during checkout | 15 min | Phase 4 |
| B2 | LFP payment window after venue confirmation | 12 h, ending no later than 2 h before start | Phase 4 |
| B3 | LFP venue confirmation deadline | Default 12 h before start; organiser can choose earlier; minimum lead time at creation 3 h | Phase 4 |
| B4 | LFP "join" without paying holds a spot | Yes, capped at 3 concurrent holds per user; holds released when the payment window ends | Phase 4 |
| B5 | Final price above estimate | Allowed; holders are warned when > 20% above estimate, and can always leave free before paying | Phase 4 |
| B6 | COMPLETED vs EXPIRED | COMPLETED if venue confirmed and ≥ 2 confirmed players (organiser counts) at `ends_at`; otherwise EXPIRED | Phase 4 |
| B7 | Max upcoming organised sessions | 10 per user | Phase 4 |
| B8 | Booking proof for EXISTING_BOOKING | Optional booking reference in MVP (admin-visible); payout hold + reports are the main protection | Phase 4 |
| B9 | Organiser not playing | Allowed; organiser gets no participant row and doesn't count toward capacity | Phase 4 |

## C. Accounts, platform and launch

| # | Decision | Recommendation | Blocks |
| --- | --- | --- | --- |
| C1 | Login methods | Email + password at launch, plus **Sign in with Apple + Google** (expected by users when payments are involved; Apple's sign-in is required on iOS once Google is offered). Phone OTP later. | Phase 3 |
| C2 | Phone number | Optional at launch; required for organisers of paid sessions (provider KYC collects it anyway) | Phase 3 |
| C3 | Launch market | UAE only: AED, `Asia/Dubai`, English; Arabic later | Phase 2 (seed, defaults) |
| C4 | Image storage | Cloudinary | Phase 4 |
| C5 | Shared packages | One `contracts` package replaces `shared-types` + `validation` | Phase 2 |
| C6 | Admin 2FA | TOTP mandatory for all staff from day one | Phase 9 |
| C7 | Hosting | API + MySQL in a Middle East or EU region (e.g. AWS `me-central-1` or Railway/Render EU + managed MySQL), web/admin on Vercel, mobile via EAS | Phase 11 |
| C8 | Domain / brand | `playaround.app` (or chosen domain) for universal links, cookies and webhooks | Phase 2 |
| C9 | Legal documents | Terms (including refund policy), privacy policy (location + payments), organiser agreement | Launch |

## D. Information needed from you

1. Does a registered company already exist, and where (mainland, DMCC, DIFC, ADGM, …)?
2. Any existing relationship with a payment provider or bank?
3. Expected launch city/cities and rough volume (sessions per week) for provider pricing talks.
4. Target launch date. Mobile + web + admin launching together drives the schedule.
