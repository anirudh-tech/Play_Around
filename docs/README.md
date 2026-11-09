# PlayAround Documentation

PlayAround is a UAE-first platform for discovering, organising and joining local sports sessions (badminton, football, cricket) on mobile and web, with a separate admin application.

**MVP payment model:** offline. Players pay organisers directly; PlayAround never collects, holds or transfers money (DEC-012). Online payments (Stripe preferred, Tap fallback) are future work only.

**Status:** Phase 10 local testing/launch tooling implemented; production launch blocked on L-05/L-07/L-08/L-09. Git is not initialised.

## Canonical documents

Each topic has exactly one canonical document. If two documents disagree, the [decision log](decisions/decision-log.md) wins, then the document listed here for that topic.

| Area | Document | What it covers |
| --- | --- | --- |
| Product | [product/overview.md](product/overview.md) | What PlayAround is, users, core loops |
| | [product/business-decisions.md](product/business-decisions.md) | Approved business rules and configurable defaults |
| | [product/mvp-scope.md](product/mvp-scope.md) | In scope, out of scope, definition of MVP done |
| | [product/roles-and-permissions.md](product/roles-and-permissions.md) | Member and staff roles, permission matrices |
| Architecture | [architecture/architecture-and-tech-stack.md](architecture/architecture-and-tech-stack.md) | Stack, modules, real-time, monorepo layout, environments |
| | [architecture/location-discovery.md](architecture/location-discovery.md) | Nearby search, radius expansion, map view |
| | [architecture/admin-application.md](architecture/admin-application.md) | Admin app, staff roles, screens |
| Database | [database/schema.md](database/schema.md) | MVP Prisma schema (fils, offline payments), constraints, transactions, seed plan |
| API | [api/api-specification.md](api/api-specification.md) | REST endpoints, payloads, Socket.IO contract, rate limits |
| Workflows | [workflows/authentication.md](workflows/authentication.md) | Sign-in methods, verification, tokens, staff TOTP |
| | [workflows/session-lifecycle.md](workflows/session-lifecycle.md) | Session, venue, participant states; splits; price changes; minimum players; notifications; jobs |
| | [workflows/venue-management.md](workflows/venue-management.md) | Venue catalogue, existing bookings, LFP venue coordination |
| | [workflows/offline-payments.md](workflows/offline-payments.md) | Payment records, statuses, permissions, disputes |
| Decisions | [decisions/decision-log.md](decisions/decision-log.md) | Approved decisions, recommendations, open questions, launch items, superseded decisions |
| Plan | [roadmap.md](roadmap.md) | Phases 1–10 for the offline MVP, post-MVP items, risks |
| | [product/phase-10-launch.md](product/phase-10-launch.md) | Coverage, E2E, k6, blocked launch items |
| Security | [security/owasp-api.md](security/owasp-api.md) | OWASP API checklist for the MVP |
| Ops | [architecture/rollback-and-runbook.md](architecture/rollback-and-runbook.md) | Local ops and production rollback (when hosted) |
| Future | [future/online-payments-stripe.md](future/online-payments-stripe.md) | **Not MVP.** Online payments design and provider research |
| Archive | [archive/README.md](archive/README.md) | **Superseded** documents kept for history |

## Status labels used in these docs

| Label | Meaning |
| --- | --- |
| **Approved** (`DEC-xxx`) | Confirmed by the product owner; implement as written |
| **Provisional** | Approved for now, subject to later review (e.g. DEC-020) |
| **Recommended** (`ARC-xxx`, some `DEC-xxx`) | Proposed technical or launch choice; not yet explicitly approved |
| **Pending O-xx** | Placeholder rule for an open question; implement behind a setting or easy-to-change rule |
| **L-xx** | Launch item requiring an external or business decision; doesn't block development |
| **Superseded** (`SUP-xxx`) | Replaced; see the archive |

## Conventions
- Money is integer **fils** (AED); times are stored in UTC and shown in Asia/Dubai.
- Docs are updated in the same change as the behaviour they describe.
- Nothing in these docs states that legal, company, domain, hosting or payment-provider approvals have been obtained.
