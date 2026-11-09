# Archive (superseded documents)

> ⚠️ **Everything in this folder is SUPERSEDED and kept for historical reference only. Do not implement from these files.**

These documents describe the Phase 1 v2 design, which assumed **online payments**: platform-collected charges, checkout reservations, payouts and service fees. That design was replaced on 8 Nov 2026 by the offline-payment MVP (DEC-012, DEC-034; superseded decisions SUP-001 to SUP-011 in the [decision log](../decisions/decision-log.md#5-superseded-decisions)).

| Archived file | Was | Superseded by | Why it's kept |
| --- | --- | --- | --- |
| [product-requirements-v2-online-payments.md](product-requirements-v2-online-payments.md) | `product/01-product-requirements.md` | [product/overview.md](../product/overview.md), [product/mvp-scope.md](../product/mvp-scope.md) | Original feature and screen descriptions |
| [business-decisions-proposals-v2.md](business-decisions-proposals-v2.md) | `product/02-business-decisions.md` | [product/business-decisions.md](../product/business-decisions.md), [decision log](../decisions/decision-log.md) | Shows which proposals were made and how they were answered |
| [session-lifecycle-v2-online-payments.md](session-lifecycle-v2-online-payments.md) | `architecture/02-session-lifecycle.md` | [workflows/session-lifecycle.md](../workflows/session-lifecycle.md) | Reservation/hold state design, if checkout is reintroduced |
| [database-schema-v2-online-payments.md](database-schema-v2-online-payments.md) | `database/schema.md` (v2) | [database/schema.md](../database/schema.md) | Payment, refund, payout and webhook tables for [future online payments](../future/online-payments-stripe.md) |
| [api-contracts-v2-online-payments.md](api-contracts-v2-online-payments.md) | `api/api-contracts.md` | [api/api-specification.md](../api/api-specification.md) | Checkout, webhook, payout and finance-admin endpoints for future online payments |

Each archived file carries a "SUPERSEDED" banner at the top. Their content is unchanged, so internal links inside them may point to old file names (for example `04-payments.md`, which is now [future/online-payments-stripe.md](../future/online-payments-stripe.md)).
