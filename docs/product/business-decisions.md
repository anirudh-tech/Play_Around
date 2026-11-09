# Approved Business Rules

These are the approved business rules (MVP) in implementation form. The [decision log](../decisions/decision-log.md) is the source of truth for status; this page groups the rules by area and lists the configurable defaults. Values marked **(pending O-xx)** are placeholders until that open question is answered.

## 1. Market and catalogue
- UAE, English, AED, Asia/Dubai (DEC-001). All timestamps are stored in UTC and displayed in Asia/Dubai.
- Sports: badminton, football, cricket. Each sport has configurable `min_players` / `max_players` / `default_players` limits (DEC-002, DEC-026).

## 2. Accounts
- Sign in with email/password, Google or Apple (DEC-035).
- Players: phone optional. Organisers: **verified phone required before publishing** (DEC-036).
- Staff accounts must use TOTP two-factor authentication (DEC-037).

## 3. Sessions

| Rule | Value | Decision |
| --- | --- | --- |
| Session types | `EXISTING_BOOKING`, `LOOKING_FOR_PLAYERS` | DEC-011 |
| Minimum lead time (creation → start) | 3 h, both types | DEC-024 |
| Max upcoming organised sessions per user | 10 | DEC-025 |
| Capacity | Required; within the sport's min/max | DEC-026 |
| Minimum players | Optional; ≥ sport minimum; ≤ capacity | DEC-026 |
| Organiser counts towards capacity/minimum | Only when participating | DEC-027 |
| LFP joinable | Only after the venue is confirmed | DEC-028 |
| Booking reference | Optional | DEC-030 |
| Minimum-player decision deadline | 2 h before start (default) | DEC-032 |
| No decision by the deadline | Automatic cancellation + notification | DEC-032 |
| Completion | Venue confirmed and ≥ 2 confirmed participating players at end | DEC-033 |
| LFP venue confirmation deadline | 12 h before start, or 2 h before start if created later **(pending O-02)** | — |
| Leave cut-off | Session start **(pending O-08)** | — |
| Attendance marking window | Start → 72 h after end **(pending O-07)** | — |

## 4. Joining and participation
- Joining confirms participation when capacity is available (DEC-016). There are no holds, reservation timers or unpaid-hold caps (DEC-034).
- Participant status: `CONFIRMED`, `CANCELLED`, `ATTENDED`, `NO_SHOW`. Payment status is tracked separately (DEC-015).

## 5. Money

| Rule | Value | Decision |
| --- | --- | --- |
| Storage | Integer fils, currency AED | DEC-019 |
| Split | Largest-remainder allocation of the total across `capacity` shares | DEC-019 |
| Remainder order | Participating organiser first, then players by join time **(pending O-05)** | — |
| Minimum paid price | AED 10 per player share, configurable | DEC-020 (provisional), O-15 |
| Free sessions | Allowed, no payment records **(pending O-09)** | — |
| Price increase threshold | > 20% of the participant's agreed share → notification + explicit consent | DEC-031 |
| Increase ≤ 20% | Notification only | DEC-031 |
| Rejecting a revised price | Participant may leave with no platform cancellation penalty | DEC-031 |
| Platform fees | None (revenue deferred) | DEC-018 |
| Wallet, payouts, online checkout | Not in MVP | DEC-021, DEC-017 |

**Split example:** total AED 100, capacity 3 → shares 3,334 + 3,333 + 3,333 fils. Total AED 120, capacity 4 → 3,000 fils each. The organiser's own share (when participating) is covered by them paying the venue, so no payment record is created for it.

## 6. Offline payments
- Players pay organisers directly; PlayAround doesn't collect, hold or transfer money (DEC-012).
- Players may report payment; only the organiser or an authorised admin confirms receipt (DEC-013).
- Refunds happen offline and are recorded (DEC-022).
- Records: `payments`, `payment_confirmations`, `payment_disputes` (DEC-023). See the [offline payment workflow](../workflows/offline-payments.md).

## 7. Venues
- PlayAround coordinates venue discovery and booking arrangements; the organiser approves the venue and pays it directly (DEC-029, DEC-014).
- PlayAround records the venue booking (venue, time, cost, optional reference, whether the organiser has paid the venue). See the [venue management workflow](../workflows/venue-management.md).

## 8. Platform settings (admin-configurable defaults)

| Key | Default |
| --- | --- |
| `sessions.min_lead_time_hours` | 3 |
| `sessions.max_upcoming_organised` | 10 |
| `sessions.min_players_decision_hours_before_start` | 2 |
| `sessions.venue_confirm_deadline_hours_before_start` | 12 (pending O-02) |
| `sessions.price_increase_consent_threshold_pct` | 20 |
| `sessions.price_consent_window_hours` | 24 (pending O-03) |
| `sessions.attendance_window_hours_after_end` | 72 (pending O-07) |
| `payments.min_paid_share_fils` | 1000 |
| `discovery.default_radius_km` | 5 |
| `discovery.max_radius_km` | 50 |
